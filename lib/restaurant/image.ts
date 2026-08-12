/**
 * Right-sizing for tenant-uploaded photos.
 *
 * A dish thumbnail renders at about 92 CSS px but the stored original is
 * whatever the owner's phone produced, so a card would otherwise pull far more
 * pixels than it draws. A thirty-dish menu opened over restaurant wifi is where
 * that adds up, and it is exactly the page whose speed matters most.
 *
 * S3 serves objects and does not transform them, so the resizing goes to Next's
 * image optimiser. It is invoked through its endpoint rather than the <Image>
 * component so every call site keeps working unchanged.
 *
 * Uploads are already downscaled to 2000px WebP in the browser (lib/upload.ts),
 * so this is the second of two reductions: that one decides what gets stored,
 * this one decides what gets sent to a particular screen.
 */

/** Set in .env.local; must match next.config.mjs images.remotePatterns. */
const CDN_HOSTNAME = process.env.NEXT_PUBLIC_CDN_HOSTNAME ?? "";

/**
 * Widths next.config.mjs allows. The optimiser 400s on anything else, so a
 * caller's requested width is rounded UP to the nearest of these — never down,
 * which would visibly soften the image.
 */
const ALLOWED_WIDTHS = [
  16, 32, 48, 64, 96, 128, 192, 224, 256, 320, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
];

function nearestAllowedWidth(width: number): number {
  return ALLOWED_WIDTHS.find((w) => w >= width) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]!;
}

/**
 * Returns a URL that delivers `url` at roughly `width` pixels.
 *
 * Anything not on our own CDN is returned untouched, so a restaurant whose logo
 * is hosted elsewhere still gets a working image rather than a broken one. The
 * same applies when NEXT_PUBLIC_CDN_HOSTNAME is unset: no optimisation, but
 * nothing breaks either.
 *
 * `height` and `fit` are accepted and ignored. The optimiser resizes on width
 * alone, which changes nothing visually — every call site draws into a
 * fixed-size box with object-cover or object-contain, so the crop was always
 * being done by CSS.
 */
export function sizedImageUrl(
  url: string,
  { width }: { width: number; height?: number; fit?: "fill" | "limit" },
): string {
  if (!url || !CDN_HOSTNAME || !url.includes(`//${CDN_HOSTNAME}/`)) return url;

  return `/_next/image?url=${encodeURIComponent(url)}&w=${nearestAllowedWidth(width)}&q=75`;
}
