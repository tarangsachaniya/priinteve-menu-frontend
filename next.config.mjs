/**
 * The only reason this file has an images block is lib/restaurant/image.ts,
 * which routes tenant photos through /_next/image to resize them. That endpoint
 * refuses any host not listed here and any width not listed here, so the two
 * files have to agree — ALLOWED_WIDTHS over there is imageSizes + deviceSizes
 * below, and 192/224/320 are present because those are the sizes the order page
 * actually asks for.
 *
 * Exactly one host is allowed: the CDN in front of our own bucket. Left empty
 * when NEXT_PUBLIC_CDN_HOSTNAME is unset, which makes image.ts fall through to
 * the Cloudinary path instead — the correct behaviour before the migration has
 * been configured, and the reason a missing variable degrades rather than
 * breaks. Read at build time, so changing it needs a rebuild.
 */
const cdnHostname = process.env.NEXT_PUBLIC_CDN_HOSTNAME;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: cdnHostname ? [{ protocol: "https", hostname: cdnHostname }] : [],
    imageSizes: [16, 32, 48, 64, 96, 128, 192, 224, 256, 320, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
};

export default nextConfig;
