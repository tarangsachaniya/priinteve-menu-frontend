/**
 * Right-sizing for tenant-uploaded photos.
 *
 * Uploads are stored at up to 800x800 (dishes) and 1600x900 (covers), which is
 * the right thing to keep — but a dish thumbnail renders at about 92 CSS px, so
 * every card was pulling roughly fifty times the pixels it drew. A thirty-dish
 * menu opened over restaurant wifi is where that adds up, and it is exactly the
 * page whose speed matters most.
 *
 * next/image is deliberately not used here. It would need every tenant's
 * Cloudinary host in next.config remotePatterns, and it would route a photo
 * that is *already* on a CDN through this Next server's optimiser to reach the
 * browser. Rewriting the delivery URL asks the CDN that already has the image
 * to do the resizing, which is both faster and less machinery.
 *
 * f_auto and q_auto do most of the work: WebP/AVIF to a browser that accepts
 * it, and Cloudinary's own quality heuristic instead of a fixed number.
 */

/** Matches a Cloudinary delivery URL — anything else is returned untouched. */
const CLOUDINARY_UPLOAD = "/image/upload/";

/**
 * Inserts a transformation into a Cloudinary URL.
 *
 * Returns the input unchanged for a URL this cannot parse, so a restaurant
 * whose logo is hosted somewhere else still gets a working image rather than a
 * broken one. Also leaves alone a URL that already carries a transformation,
 * which would otherwise be silently chained on top of.
 */
export function sizedImageUrl(
  url: string,
  { width, height, fit = "fill" }: { width: number; height?: number; fit?: "fill" | "limit" },
): string {
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
