/**
 * Browser half of "your order is ready" push — the diner's own phone, not a
 * staff device. See priinteve-api/src/services/restaurant/push.ts for why
 * that's a separate subscription table with a separate cleanup policy; from
 * the browser's side the two look almost identical, which is why this reuses
 * lib/restaurant/push-client.ts's feature-detection and service-worker
 * registration rather than duplicating them. Same service worker, too
 * (public/sw.js) — ORDER_READY is just a second payload type its describe()
 * knows how to render, registered at root scope, which already covers
 * /order/* pages.
 *
 * Same best-effort posture as the staff client: an unsupported browser, a
 * declined permission or a dead push service must degrade to "chime and
 * speech only while this tab stays open" (see order-status-tracker.tsx)
 * rather than break the page.
 */

import { isPushSupported, registerServiceWorker, urlBase64ToBytes } from "@/lib/restaurant/push-client";

async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/order/push/public-key", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey: string | null; enabled: boolean };
    return data.enabled ? data.publicKey : null;
  } catch {
    return null;
  }
}

/**
 * Subscribes this device to hear about one order, and only that order.
 *
 * MUST be called from a user gesture, same constraint as enablePush() in
 * push-client.ts — Notification.requestPermission() is ignored or auto-denied
 * outside one. This is why it belongs on the same "tap to enable alerts"
 * interaction as the chime/speech unlock, not on page load.
 *
 * Silent by design on every failure path: this is a bonus layer over a page
 * that already chimes and speaks while it's open, so there is nothing for the
 * caller to show the guest beyond leaving the request unfulfilled. It never
 * throws.
 */
export async function enableOrderReadyPush(orderId: string): Promise<void> {
  if (!isPushSupported()) return;

  const publicKey = await fetchPublicKey();
  if (!publicKey) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
  if (!registration) return;

  await navigator.serviceWorker.ready;

  try {
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      }));

    const json = subscription.toJSON();

    await fetch(`/api/order/${orderId}/push-subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      }),
    });
  } catch (err) {
    console.error("[push] order-ready subscribe failed", err);
  }
}
