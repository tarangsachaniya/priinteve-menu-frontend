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

  /**
   * The order-alert service worker must never be served from cache.
   *
   * Files in /public get a long-lived cache header, and a service worker is the
   * one file where that is actively harmful: the worker is what turns a push
   * into a notification, so a stale copy means a restaurant keeps running last
   * month's alert logic with no way to tell. Browsers cap SW script caching at
   * 24h on their own, but 24h is still a day of a known-broken kitchen alert.
   *
   * The manifest gets the same treatment for a smaller reason — changing the
   * app name or icon should reach an installed phone on the next launch.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
