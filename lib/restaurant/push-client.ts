/**
 * Browser half of the order-alert push.
 *
 * Everything here is best-effort by design: push is a bonus layer over a
 * console that already polls, so an unsupported browser, a declined permission
 * or a dead push service must degrade to "alerts only while a tab is open"
 * rather than break the page.
 *
 * The API counterpart is priinteve-api/src/routes/restaurant/push.routes.ts.
 */

/**
 * What the console needs to know to render the right control.
 *
 *   unsupported   no service worker or no Push API — an old browser, or Safari
 *                 on iOS before the page is added to the Home Screen
 *   unavailable   the server has no VAPID keys configured
 *   denied        the user said no; only they can undo it, in site settings
 *   default       never asked — this is the state the Enable button is for
 *   subscribed    registered and stored server-side
 */
export type PushState = "unsupported" | "unavailable" | "denied" | "default" | "subscribed";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Registers the worker at root scope, which is what lets one registration cover
 * every /r/* page. Safe to call repeatedly — the browser returns the existing
 * registration rather than installing a second worker.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.error("[push] service worker registration failed", err);
    return null;
  }
}

/**
 * The VAPID public key arrives as base64url text and pushManager.subscribe()
 * wants raw bytes. Standard conversion — the padding and the two substitutions
 * are what make base64url decode as base64.
 *
 * Returns the ArrayBuffer rather than the view: applicationServerKey is typed
 * as BufferSource, and a Uint8Array built without an explicit backing buffer
 * infers ArrayBufferLike, which TypeScript will not narrow to it.
 *
 * Exported: lib/order-push-client.ts (the diner's own "order ready" push,
 * subscribing against a different endpoint but the same VAPID keypair and the
 * same conversion) reuses this rather than a second copy.
 */
export function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/restaurant/push/public-key", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey: string | null; enabled: boolean };
    return data.enabled ? data.publicKey : null;
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  const publicKey = await fetchPublicKey();
  if (!publicKey) return "unavailable";

  if (Notification.permission !== "granted") return "default";

  // Granted is not the same as subscribed: permission survives a cleared
  // subscription, so the only way to know is to ask the registration.
  const registration = await navigator.serviceWorker.getRegistration("/");
  const existing = await registration?.pushManager.getSubscription();
  return existing ? "subscribed" : "default";
}

/**
 * Turns alerts on for this device.
 *
 * MUST be called from a user gesture — Notification.requestPermission() is
 * ignored (or auto-denied, in Chrome's case) outside one, and worse, a browser
 * that auto-denies leaves the user in the "denied" state they cannot escape
 * from the page. This is why the console never calls it on mount.
 */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) {
    return { ok: false, reason: "This browser can't show order alerts." };
  }

  const publicKey = await fetchPublicKey();
  if (!publicKey) {
    return { ok: false, reason: "Order alerts aren't configured on this server yet." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Notifications are blocked. Allow them in your browser's site settings." };
  }

  const registration = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
  if (!registration) return { ok: false, reason: "Couldn't start the alert service." };

  // Waits for the worker to reach "activated". Subscribing against a still-
  // installing registration throws, and on a first-ever visit that is exactly
  // the state it is in.
  await navigator.serviceWorker.ready;

  try {
    // userVisibleOnly is mandatory in Chrome — the browser requires a promise
    // that every push results in something the user sees, which sw.js keeps.
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      }));

    const json = subscription.toJSON();

    const res = await fetch("/api/restaurant/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        userAgent: navigator.userAgent.slice(0, 300),
      }),
    });

    if (!res.ok) {
      // Roll the browser-side subscription back. Leaving it in place would mean
      // a device the push service will happily deliver to and a server that has
      // no idea it exists — silent, and impossible to diagnose from the console.
      await subscription.unsubscribe().catch(() => {});
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: data.error ?? "Couldn't register this device." };
    }

    return { ok: true };
  } catch (err) {
    console.error("[push] subscribe failed", err);
    return { ok: false, reason: "Couldn't register this device for alerts." };
  }
}

/** Turns alerts off for this device, server-side row included. */
export async function disablePush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return true;

  // Server first: if the browser unsubscribed first and this call then failed,
  // the row would be orphaned with no endpoint left to delete it by.
  await fetch("/api/restaurant/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});

  return subscription.unsubscribe().catch(() => false);
}

/** Backs the "Send test alert" button. */
export async function sendTestPush(): Promise<{ ok: boolean; sent: number; reason?: string }> {
  try {
    const res = await fetch("/api/restaurant/push/test", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
    if (!res.ok) return { ok: false, sent: 0, reason: data.error ?? "Couldn't send a test alert." };
    return { ok: true, sent: data.sent ?? 0 };
  } catch {
    return { ok: false, sent: 0, reason: "Couldn't reach the server." };
  }
}
