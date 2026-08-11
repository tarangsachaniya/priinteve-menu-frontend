/**
 * Colour maths for multi-tenant brand theming.
 *
 * sRGB ⇄ OKLab ⇄ OKLCH (Björn Ottosson's transform) plus WCAG contrast.
 * Lightness is shifted in OKLCH rather than mixed with white/black in sRGB,
 * because sRGB mixing desaturates and muddies mid-tones — a brand orange
 * lightened in sRGB turns brown, in OKLCH it stays orange.
 */

export type Rgb = { r: number; g: number; b: number };
export type Oklch = { l: number; c: number; h: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

/** sRGB gamma → linear light. */
function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** Linear light → sRGB gamma. */
function toGamma(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.sqrt(okA * okA + okB * okB);
  let hue = (Math.atan2(okB, okA) * 180) / Math.PI;
  if (hue < 0) hue += 360;

  return { l: okL, c: chroma, h: hue };
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hRad = (h * Math.PI) / 180;
  const okA = c * Math.cos(hRad);
  const okB = c * Math.sin(hRad);

  const lCube = l + 0.3963377774 * okA + 0.2158037573 * okB;
  const mCube = l - 0.1055613458 * okA - 0.0638541728 * okB;
  const sCube = l - 0.0894841775 * okA - 1.291485548 * okB;

  const lLin = lCube * lCube * lCube;
  const mLin = mCube * mCube * mCube;
  const sLin = sCube * sCube * sCube;

  return {
    r: toGamma(4.0767416621 * lLin - 3.3077115913 * mLin + 0.2309699292 * sLin),
    g: toGamma(-1.2684380046 * lLin + 2.6097574011 * mLin - 0.3413193965 * sLin),
    b: toGamma(-0.0041960863 * lLin - 0.7034186147 * mLin + 1.707614701 * sLin),
  };
}

function isInGamut({ r, g, b }: Rgb): boolean {
  const epsilon = 0.0001;
  return [r, g, b].every((channel) => channel >= -epsilon && channel <= 1 + epsilon);
}

/**
 * Reduces chroma until the colour fits inside sRGB, keeping lightness and hue.
 * Without this, a light step of a vivid seed clips per channel and shifts hue.
 */
export function toGamutRgb(oklch: Oklch): Rgb {
  let low = 0;
  let high = oklch.c;
  let candidate = oklchToRgb(oklch);

  if (isInGamut(candidate)) {
    return { r: clamp01(candidate.r), g: clamp01(candidate.g), b: clamp01(candidate.b) };
  }

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    candidate = oklchToRgb({ ...oklch, c: mid });
    if (isInGamut(candidate)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const final = oklchToRgb({ ...oklch, c: low });
  return { r: clamp01(final.r), g: clamp01(final.g), b: clamp01(final.b) };
}

export function oklchToHex(oklch: Oklch): string {
  return toHex(toGamutRgb(oklch));
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
  );
}

/** WCAG 2.1 contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastRatioHex(a: string, b: string): number {
  const rgbA = parseHex(a);
  const rgbB = parseHex(b);
  if (!rgbA || !rgbB) return 1;
  return contrastRatio(rgbA, rgbB);
}

/** Shortest distance between two hues, in degrees (0–180). */
export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
