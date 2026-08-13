/**
 * Order-alert service worker.
 *
 * Plain JS on purpose — this file is served verbatim from /public and never
 * passes through the Next build, so it cannot import anything, cannot use JSX
 * or TypeScript, and must stay small enough to read in one sitting.
 *
 * WHY IT EXISTS: a page can only be told about an order while the page is
 * running. A browser throttles a hidden tab's timers to roughly once a minute
 * and stops them entirely when it closes. A service worker has no such
 * problem — the push service wakes it whether or not any tab exists — which is
 * what makes "the kitchen finds out while the window is minimized" possible.
 *
 * THE DIVISION OF LABOUR, which is the thing to understand before editing:
 *
 *   showNotification()  — always. This is the OS-level popup, and it is the
 *                         only half that works when the browser is closed. It
 *                         plays the operating system's notification sound.
 *   postMessage()       — when a console window exists. That page can do what
 *                         this worker cannot: play the synthesized damru and
 *                         show the in-app dialog.
 *
 * The showNotification is NOT optional. Chrome enforces that every push a site
 * receives results in a visible notification, and an origin that repeatedly
 * pushes silently has its push permission revoked — which would break the
 * feature for that restaurant permanently, with no error anyone would see.
 */

const CONSOLE_URL = "/r/orders";
const ICON = "/icons/icon-512.png";

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every console tab to close.
  // A worker fix that only ships to people who quit their browser is a worker
  // fix that does not ship.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Renders the payload into the two lines a notification gets.
 *
 * Kept blunt: the number identifies the ticket, the table is where the food
 * goes, the total is the sanity check. Anything more is unreadable at a glance
 * on a phone lock screen, which is where this is actually read.
 */
function describe(data) {
  if (data.type === "TEST") {
    return { title: "Test alert", body: data.message ?? "Order alerts are working." };
  }

  const where =
    data.tableLabel ??
    (data.orderType === "TAKE_AWAY"
      ? "Take away"
      : data.orderType === "DELIVERY"
        ? "Delivery"
        : "Dine in");

  const items = data.itemCount === 1 ? "1 item" : `${data.itemCount} items`;

  return {
    title: `New order #${data.orderNumber} · ${where}`,
    body: `${items} · ₹${data.total}${data.customerName ? ` · ${data.customerName}` : ""}`,
  };
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A malformed payload must still produce a notification — see the
    // permission-revocation note at the top.
    data = {};
  }

  const { title, body } = data.type
    ? describe(data)
    : { title: "New order", body: "Open the console to see it." };

  event.waitUntil(
    (async () => {
      // Tell any open console window first, so the damru starts while the OS
      // is still drawing its popup rather than after it.
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        client.postMessage({ source: "priinteve-order-alerts", payload: data });
      }

      await self.registration.showNotification(title, {
        body,
        icon: ICON,
        badge: ICON,
        // Collapses a repeat of the SAME order rather than stacking it. The
        // console also polls as a fallback, so one order can legitimately
        // arrive down two paths; without a stable tag that shows up as two
        // notifications for one ticket.
        tag: data.orderId ? `order-${data.orderId}` : "order-alert",
        // …but a genuinely new order with the same tag should still alert
        // rather than swap in silently.
        renotify: true,
        // Stays on screen until someone deals with it. A kitchen alert that
        // auto-dismisses after four seconds is one nobody sees.
        requireInteraction: data.type !== "TEST",
        data: { url: CONSOLE_URL },
      });
    })(),
  );
});

/**
 * Clicking the notification should land on the board, not open a fifth copy of
 * the console. Focuses an existing window when there is one — including a
 * console sitting on some other page, which is navigated across.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || CONSOLE_URL;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        const url = new URL(client.url);
        if (url.origin !== self.location.origin) continue;
        await client.focus();
        if (!url.pathname.startsWith("/r/orders") && "navigate" in client) {
          await client.navigate(target);
        }
        return;
      }

      await self.clients.openWindow(target);
    })(),
  );
});
