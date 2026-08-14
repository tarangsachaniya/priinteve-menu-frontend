"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a wall-mounted screen awake.
 *
 * A kitchen display or a pickup board that blanks after two minutes of no
 * touches is not a display — and neither screen is ever touched in normal use,
 * which is exactly the condition every OS uses to decide the device is idle.
 *
 * THE DETAIL THAT IS ALWAYS MISSED: the browser releases the sentinel by itself
 * whenever the document becomes hidden — switching tabs, locking the device,
 * even minimising. It is never re-acquired automatically. Without the
 * visibilitychange handler below, the lock survives exactly until the first time
 * someone glances at another tab, and then the screen sleeps for the rest of
 * service with nothing on screen to say so.
 *
 * `active` is returned so the UI can admit when this failed. Wake Lock is
 * unsupported on older Android WebViews and on Safari before 16.4, and a screen
 * that dies at midnight with no explanation is a worse outcome than a small
 * line of text warning that the device's own display timeout still applies.
 */

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockCapableNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export type WakeLockState = {
  /** True while the screen is being held awake. */
  active: boolean;
  /** True when this browser has no Wake Lock API at all. */
  unsupported: boolean;
};

export function useWakeLock(enabled = true): WakeLockState {
  const [active, setActive] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const wakeLock = (navigator as WakeLockCapableNavigator).wakeLock;
    if (!wakeLock) {
      setUnsupported(true);
      return;
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;

      try {
        sentinel = await wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        setActive(true);
        // Fires both when we release it and when the browser does. Either way
        // the indicator must stop claiming the screen is being held.
        sentinel.addEventListener("release", () => setActive(false));
      } catch {
        // Denied — some browsers refuse on battery saver. Not fatal, and not
        // worth retrying in a loop; the next visibilitychange will try again.
        setActive(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
      setActive(false);
    };
  }, [enabled]);

  return { active, unsupported };
}
