/**
 * Customer-facing URLs for display in the console — e.g. the "share this
 * link" line on the dashboard and tables pages. Not to be confused with the
 * API's services/restaurant/qr.ts, which builds the exact same URLs but
 * bakes them into printed QR code image bytes (GET /api/restaurant/tables/
 * :id/qr and /tables/qr-sheet); that one lives on the API because changing
 * MENU_APP_URL there is the single point of truth for what a physical,
 * already-printed QR code points at. This copy is display-only.
 */

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

export function getTableOrderUrl(restaurantSlug: string, tableCode: string): string {
  return `${baseUrl()}/order/${restaurantSlug}/${tableCode}`;
}

export function getRestaurantOrderUrl(restaurantSlug: string): string {
  return `${baseUrl()}/order/${restaurantSlug}`;
}

export function getOrderStatusUrl(restaurantSlug: string, orderId: string): string {
  return `${baseUrl()}/order/${restaurantSlug}/status/${orderId}`;
}
