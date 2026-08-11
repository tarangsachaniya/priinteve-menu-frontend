/**
 * Brand seed colour maths for the restaurant template.
 *
 * One hex from the restaurant owner drives the whole accent ramp. The ramp
 * itself is derived in CSS (app/resto-theme.css, relative colour syntax), so
 * nothing here runs on every render. What CSS *cannot* do is the two things
 * this module exists for:
 *
 *   1. Decide `--on-brand` — whether text sitting on the brand fill must be
 *      white or near-black. That is a luminance decision, and it is what makes
 *      a yellow restaurant and a navy restaurant both get legible buttons.
 *   2. Validate the seed at onboarding (spec §3). Accepting an arbitrary hex
 *      from a restaurant owner is where multi-tenant theming usually breaks,
 *      so the guard sits at the input.
 *
 * Pure functions, no React and no DOM: the same code runs server-side when a
 * menu is rendered and client-side in the owner's live preview.
 *
 * No colour library — the project has none, and the maths below is the
 * standard Oklab conversion (Björn Ottosson) plus WCAG relative luminance.
 */

/** Schema default, mirrored from Restaurant.brandColor. */
export const DEFAULT_RESTO_BRAND = "#16A34A";

/**
 * Locked palette anchors the seed is validated against. These MUST match the
 * `--resto-bg` declarations in app/resto-theme.css — a seed judged legible
 * here and rendered against a different background is a silent lie.
 */
export const RESTO_LIGHT_BG = "#FDFAF4";
export const RESTO_DARK_BG = "#110C08";

/** Semantic red from the locked palette, used for the collision check. */
export const RESTO_ERROR = "#DC2626";

/** Hyper-saturated seeds render inconsistently and look garish next to food photography. */
const MAX_CHROMA = 0.26;
/** Below this a seed reads as grey and the restaurant looks unbranded. */
const NEUTRAL_CHROMA = 0.03;
/** WCAG AA for normal text. */
const MIN_CONTRAST = 4.5;
/** Hue window, in degrees, within which a seed is confusable with --error. */
const ERROR_HUE_WINDOW = 20;

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export type Oklch = { l: number; c: number; h: number };

// ─── sRGB ⇄ Oklab ──────────────────────────────────────────────────────────

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!HEX_PATTERN.test(hex.trim())) return null;
  const value = hex.trim().slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  };
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

export function isHexColor(value: string | null | undefined): boolean {
  return typeof value === "string" && HEX_PATTERN.test(value.trim());
}

export function hexToOklch(hex: string): Oklch {
  const rgb = parseHex(hex) ?? { r: 0, g: 0, b: 0 };
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const lCone = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mCone = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sCone = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const l = 0.2104542553 * lCone + 0.793617785 * mCone - 0.0040720468 * sCone;
  const a = 1.9779984951 * lCone - 2.428592205 * mCone + 0.4505937099 * sCone;
  const bAxis = 0.0259040371 * lCone + 0.7827717662 * mCone - 0.808675766 * sCone;

  const c = Math.sqrt(a * a + bAxis * bAxis);
  // Hue is meaningless for a neutral; report 0 rather than atan2's noise.
  const h = c < 1e-6 ? 0 : ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360;

  return { l, c, h };
}

/** Oklch → linear sRGB, unclamped, so gamut membership can be tested. */
function oklchToLinearRgb({ l, c, h }: Oklch): { r: number; g: number; b: number } {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const bAxis = c * Math.sin(radians);

  const lCone = (l + 0.3963377774 * a + 0.2158037573 * bAxis) ** 3;
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * bAxis) ** 3;
  const sCone = (l - 0.0894841775 * a - 1.291485548 * bAxis) ** 3;

  return {
    r: 4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    g: -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    b: -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
  };
}

function inGamut({ r, g, b }: { r: number; g: number; b: number }): boolean {
  const epsilon = 1e-4;
  return (
    r >= -epsilon && r <= 1 + epsilon && g >= -epsilon && g <= 1 + epsilon && b >= -epsilon && b <= 1 + epsilon
  );
}

/**
 * Oklch → hex, reducing chroma until the colour fits sRGB.
 *
 * Naive clamping of out-of-gamut channels shifts hue — a bright orange
 * clipped channel-wise slides towards yellow. Binary-searching chroma keeps
 * lightness and hue exactly and gives up only saturation, which is the one
 * dimension a viewer will not notice being wrong.
 */
export function oklchToHex(colour: Oklch): string {
  const direct = oklchToLinearRgb(colour);
  if (inGamut(direct)) {
    return toHex(linearToSrgb(direct.r), linearToSrgb(direct.g), linearToSrgb(direct.b));
  }

  let low = 0;
  let high = colour.c;
  for (let i = 0; i < 20; i += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToLinearRgb({ ...colour, c: mid }))) low = mid;
    else high = mid;
  }

  const fitted = oklchToLinearRgb({ ...colour, c: low });
  return toHex(linearToSrgb(fitted.r), linearToSrgb(fitted.g), linearToSrgb(fitted.b));
}

// ─── Contrast ──────────────────────────────────────────────────────────────

/** WCAG 2.1 relative luminance. Not Oklab L — the two are not interchangeable. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex) ?? { r: 0, g: 0, b: 0 };
  return (
    0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Text/icon colour for anything sitting on the brand fill.
 *
 * Spec §2 names #FFF and #111 as the two options, and those are what this
 * returns for almost every seed. But #111 is not black — it carries enough
 * luminance that a band of mid-tone seeds (#9966AA and its neighbours, a
 * perfectly ordinary mauve) clears neither option, bottoming out at 4.35:1.
 * Dropping to true black in exactly that case restores the floor to 4.58:1
 * across the entire sRGB cube, which is what makes the guarantee real: no
 * possible seed produces an illegible button.
 *
 * Verified by sweeping the cube — see the worst-case assertion in the
 * accompanying check rather than trusting the algebra.
 */
export function onBrandColor(seedHex: string): string {
  // Direction is decided against true black, not #111: judging it against the
  // softened value makes white win ties it should lose (#877850 scores 4.345
  // either way, while black gives it 4.833) and strands the seed below AA.
  if (contrastRatio("#FFFFFF", seedHex) >= contrastRatio("#000000", seedHex)) return "#FFFFFF";

  // Dark side wins — take the spec's #111 when it still clears AA on its own.
  return contrastRatio("#111111", seedHex) >= MIN_CONTRAST ? "#111111" : "#000000";
}

// ─── Ramp steps that need checking ─────────────────────────────────────────

/**
 * Walks a ramp step's lightness until it clears MIN_CONTRAST against its
 * background. `step` is signed: negative darkens (light mode), positive
 * lightens (dark mode).
 */
function fitTextStep(seed: Oklch, startL: number, background: string, step: number): string {
  let l = startL;
  for (let i = 0; i < 40; i += 1) {
    const hex = oklchToHex({ ...seed, l });
    if (contrastRatio(hex, background) >= MIN_CONTRAST) return hex;
    l += step;
    if (l <= 0.05 || l >= 0.99) break;
  }
  return oklchToHex({ ...seed, l: step < 0 ? 0.15 : 0.97 });
}

// ─── Public API ────────────────────────────────────────────────────────────

export type BrandIssueCode = "invalid" | "contrast" | "chroma" | "neutral" | "error-collision";

export type BrandIssue = {
  level: "error" | "warning";
  code: BrandIssueCode;
  message: string;
};

export type BrandValidation = {
  /** False only for input the owner must change before it can be saved. */
  ok: boolean;
  /** What will actually be stored and painted — may differ from the input. */
  normalized: string;
  /** True when normalisation changed the colour, so the UI can show before/after. */
  adjusted: boolean;
  issues: BrandIssue[];
};

/**
 * Spec §3, in order. Everything that can be fixed automatically is fixed and
 * reported; only genuinely unusable input is rejected.
 */
export function validateBrandSeed(input: string): BrandValidation {
  if (!isHexColor(input)) {
    return {
      ok: false,
      normalized: DEFAULT_RESTO_BRAND,
      adjusted: true,
      issues: [{ level: "error", code: "invalid", message: "Enter a colour like #F97316." }],
    };
  }

  const raw = input.trim().toUpperCase();
  const seed = hexToOklch(raw);
  const issues: BrandIssue[] = [];

  // Chroma ceiling — normalise rather than reject, and show the change.
  let normalized = raw;
  if (seed.c > MAX_CHROMA) {
    normalized = oklchToHex({ ...seed, c: MAX_CHROMA });
    issues.push({
      level: "warning",
      code: "chroma",
      message: "That colour is unusually intense, so we've toned it down slightly to sit better next to food photography.",
    });
  }

  const settled = hexToOklch(normalized);

  // Near-neutral — allowed, but the owner should know what they're getting.
  if (settled.c < NEUTRAL_CHROMA) {
    issues.push({
      level: "warning",
      code: "neutral",
      message: "This reads as grey rather than a brand colour. Buttons and highlights won't stand out.",
    });
  }

  // Collision with the semantic error red. hueGap is the circular distance in
  // degrees: 0 means the seed sits exactly on the error hue.
  const errorHue = hexToOklch(RESTO_ERROR).h;
  const hueGap = Math.abs(((settled.h - errorHue + 540) % 360) - 180);
  if (settled.c > 0.12 && hueGap < ERROR_HUE_WINDOW) {
    issues.push({
      level: "warning",
      code: "error-collision",
      message: "This is close to the red we use for failures and closures. Those states will still be marked with an icon and wording, not colour alone.",
    });
  }

  // On-brand contrast. The auto-flip makes this effectively unreachable, but
  // it is the guarantee the whole theming model rests on, so it is asserted
  // rather than assumed.
  const onBrand = onBrandColor(normalized);
  if (contrastRatio(onBrand, normalized) < MIN_CONTRAST) {
    issues.push({
      level: "error",
      code: "contrast",
      message: "Text can't be made legible on this colour. Try a darker or lighter version of it.",
    });
  }

  return {
    ok: !issues.some((issue) => issue.level === "error"),
    normalized,
    adjusted: normalized !== raw,
    issues,
  };
}

export type BrandTheme = {
  /** Normalised seed — the value CSS derives the whole ramp from. */
  seed: string;
  /** Foreground for anything on the brand fill. */
  onBrand: string;
  /**
   * Overrides for the two ramp steps used as *text*, supplied only when the
   * value CSS would derive fails contrast. The ramp stays pure CSS; these
   * patch the one step that can't be guaranteed by lightness alone.
   */
  textOnLight: string;
  textOnDark: string;
};

/**
 * Everything the theme scope needs to inject inline. Falls back to the schema
 * default so a restaurant with a missing or corrupt colour still renders.
 */
export function resolveBrandTheme(input: string | null | undefined): BrandTheme {
  const seed = isHexColor(input) ? validateBrandSeed(input!).normalized : DEFAULT_RESTO_BRAND;
  const oklch = hexToOklch(seed);

  return {
    seed,
    onBrand: onBrandColor(seed),
    // Spec §2: --brand-800 is "brand text on light backgrounds", seed at L 35%.
    textOnLight: fitTextStep(oklch, 0.35, RESTO_LIGHT_BG, -0.02),
    // Dark mode needs the mirror of that — a light step on the near-black page.
    textOnDark: fitTextStep(oklch, 0.72, RESTO_DARK_BG, 0.02),
  };
}
