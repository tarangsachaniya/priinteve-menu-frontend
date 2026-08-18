"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { KitchenDisplay } from "@/components/restaurant/kitchen-display";
import { OrderAlertProvider } from "@/components/restaurant/order-alert-provider";
import type { KitchenOrder } from "@/lib/restaurant/live-order";
import { screenLockPath, screenOrdersPath } from "@/lib/restaurant/screen-paths";

/**
 * The kitchen display as a mounted, PIN-unlocked screen.
 *
 * Everything it does differently from /r/kitchen comes from one fact: there is
 * no staff session on this device. So it reads and writes through
 * /api/screen/<token>/orders, it can lock itself, and it stops trusting its own
 * state the moment the API says its credentials are no longer good.
 *
 * The alert provider is mounted here too, with the dialog off, push off — a
 * screen nobody is signed into cannot register for Web Push — and the sound off,
 * because KitchenDisplay rings for itself when an order reaches the pass. What
 * the provider still contributes is the ringing pill and the tab badge.
 */
export function KitchenScreen({
  token,
  restaurantName,
  initialOrders,
}: {
  token: string;
  restaurantName: string;
  initialOrders: KitchenOrder[];
}) {
  const router = useRouter();
  const ordersBasePath = screenOrdersPath(token);

  /**
   * Re-runs the server component, which probes the screen again and finds it
   * locked. One path for both cases — the Lock button and a revoked session —
   * because they land in exactly the same place.
   */
  const relock = useCallback(() => router.refresh(), [router]);

  const lock = useCallback(async () => {
    await fetch(screenLockPath(token), { method: "POST" }).catch(() => {});
    relock();
  }, [token, relock]);

  return (
    <>
      <KitchenDisplay
        initialOrders={initialOrders}
        ordersBasePath={ordersBasePath}
        restaurantName={restaurantName}
        onLock={() => void lock()}
        onSessionLost={relock}
      />
      <OrderAlertProvider
        showDialog={false}
        enablePush={false}
        ordersBasePath={ordersBasePath}
        surface="kitchen"
        ring={false}
      />
    </>
  );
}
