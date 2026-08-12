/**
 * Right-sizing for tenant-uploaded photos.
 *
 * A dish thumbnail renders at about 92 CSS px but the stored original is
 * whatever the owner's phone produced, so every card was pulling far more
 * pixels than it drew. A thirty-dish menu opened over restaurant wifi is where
 * that adds up, and it is exactly the page whose speed matters most.
 *
 * This used to rewrite the Cloudinary delivery URL, asking the CDN that already
 * held the image to resize it — cheaper than routing the bytes through this
 * Next server, and the reason next/image was deliberately avoided. Storage has
 * since moved to S3 behind CloudFront, which serves objects and does not
 * transform them, so that option no longer exists: something has to do the
 * resizing, and Next's optimiser is the one piece of machinery already in the
 * stack that can. It is invoked through its own endpoint rather than the
 * <Image> component so every call site keeps working unchanged.
 *
 * Both paths are live during the migration. Assets already moved to S3 come
 * back as CloudFront URLs and go through the optimiser; assets still on
 * Cloudinary keep the URL rewrite. A page rendering some of each is normal
 * until the database migration finishes.
 */

/** Set in .env.local; must match next.config.mjs images.remotePatterns. */
const CDN_HOSTNAME = process.env.NEXT_PUBLIC_CDN_HOSTNAME ?? "";

const CLOUDINARY_UPLOAD = "/image/upload/";

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
 * Returns the input unchanged for anything it cannot handle, so a restaurant
 * whose logo is hosted somewhere else still gets a working image rather than a
 * broken one.
 *
 * `height` and `fit` are accepted but only affect the Cloudinary path. The
 * optimiser resizes on width alone, which changes nothing visually: every call
 * site draws into a fixed-size box with object-cover or object-contain, so the
 * crop was always being done by CSS and the c_fill parameter was only ever
 * saving a few bytes on the wire.
 */
export function sizedImageUrl(
  url: string,
  { width, height, fit = "fill" }: { width: number; height?: number; fit?: "fill" | "limit" },
): string {
  if (!url) return url;

  // ─── S3 / CloudFront: hand it to the Next image optimiser ──────────────────
  if (CDN_HOSTNAME && url.includes(`//${CDN_HOSTNAME}/`)) {
    return `/_next/image?url=${encodeURIComponent(url)}&w=${nearestAllowedWidth(width)}&q=75`;
  }

  // ─── Cloudinary: rewrite the delivery URL, as before ───────────────────────
  const marker = url.indexOf(CLOUDINARY_UPLOAD);
  if (marker === -1) return url;

  const cut = marker + CLOUDINARY_UPLOAD.length;
  const rest = url.slice(cut);

  // A version segment (v1712…) is expected right after /upload/; anything else
  // in that position is an existing transformation we must not double up on.
  if (!/^v\d+\//.test(rest)) return url;

  const transform = [
    "f_auto",
    "q_auto",
    `c_${fit}`,
    `w_${width}`,
    ...(height ? [`h_${height}`] : []),
    // dpr_auto lets the CDN serve 2x to a retina phone off the same URL.
    "dpr_auto",
  ].join(",");

  return `${url.slice(0, cut)}${transform}/${rest}`;
}
