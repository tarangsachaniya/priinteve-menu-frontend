"use client";

import { useEffect } from "react";

/**
 * Keeps the restaurant session sliding forward instead of expiring under a
 * console that is plainly in use.
 *
 * The API already renews: requireRestaurant calls touchRestaurantSession, which
 * reissues pv_resto with a fresh 24h window once less than half of it remains.
 * The problem is delivery. The call that guards every /r page comes from a
 * React Server Component (getRestaurantSession in lib/api/server.ts), and an
 * RSC cannot set cookies — lib/api/http.ts does not even look at the response
 * headers, because there would be nothing it could do with them. So the renewed
 * Set-Cookie was produced, handed to the Next server, and dropped.
 *
 * A renewal only reaches the browser when the browser made the request. This
 * component makes sure one always does: same-origin fetch through
 * app/api/[...path]/route.ts, which relays every Set-Cookie verbatim.
 *
 * The orders poll in order-alert-provider.tsx happens to do this too, but only
 * where it is mounted and only while it is polling. Renewal is not something to
 * leave depending on an unrelated component's schedule.
 *
 * Thirty minutes, against a 24h window with a 12h renewal threshold, is far
 * more often than strictly needed — and deliberately so. It costs one tiny
 * request an hour and it means the session survives a laptop that was asleep
 * for most of the day, which is the case that actually bites.
 */
const KEEPALIVE_INTERVAL_MS = 30 * 60 * 1000;

export function SessionKeepalive() {
  useEffect(() => {
    // A failure here is not actionable and must stay silent: if the session
    // really is gone, the next navigation redirects to /r/login on its own.
    // Toasting "session refresh failed" at a kitchen mid-service would be noise
    // about something they cannot fix.
    const ping = () => {
      void fetch("/api/restaurant/session", { method: "GET", cache: "no-store" }).catch(() => {});
    };

    ping();
    const timer = window.setInterval(ping, KEEPALIVE_INTERVAL_MS);

    // Coming back from a sleeping laptop or a backgrounded phone is exactly
    // when the cookie is closest to expiry and the interval is least likely to
    // have fired, so renew on the way back in rather than waiting for it.
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
