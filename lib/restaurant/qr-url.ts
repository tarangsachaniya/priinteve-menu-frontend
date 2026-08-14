/**
 * The restaurant's own public ordering URL, for display in the console.
 *
 * Not to be confused with the API's services/restaurant/qr.ts, which builds
 * the URLs baked into printed QR code image bytes. That one lives on the API
 * because changing MENU_APP_URL there is the single point of truth for what a
 * physical, already-printed QR code points at. This copy is display-only.
 *
 * getTableOrderUrl() USED TO LIVE HERE and was deliberately removed. A table's
 * ordering URL is derived from its `code`, the API no longer sends a code to
 * anyone but a platform admin, and the admin screens get the finished URL from
 * GET /api/admin/restaurants/:id/tables rather than assembling one. Leaving a
 * client-side builder in place would be an invitation to reintroduce the leak
 * the moment someone finds a table code in a payload.
 */

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

export function getRestaurantOrderUrl(restaurantSlug: string): string {
  return `${baseUrl()}/order/${restaurantSlug}`;
}

export function getOrderStatusUrl(restaurantSlug: string, orderId: string): string {
  return `${baseUrl()}/order/${restaurantSlug}/status/${orderId}`;
}

/**
 * The two mounted-screen links, for the owner to copy into a tablet or a TV.
 *
 * Unlike the table URLs removed above, these belong here: a screen token is
 * meant to be shown to the owner — reading it off this card and typing it into
 * a device is the entire setup flow. It is still a credential, so the settings
 * card treats it like one (revocable, rotatable, and never rendered anywhere a
 * guest can reach).
 */
export function getKitchenScreenUrl(kitchenToken: string): string {
  return `${baseUrl()}/kds/${kitchenToken}`;
}

export function getPickupDisplayUrl(displayToken: string): string {
  return `${baseUrl()}/display/${displayToken}`;
}
