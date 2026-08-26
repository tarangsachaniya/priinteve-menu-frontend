import type { Metadata } from "next";
import { Monitor } from "lucide-react";
import { notFound } from "next/navigation";

import { PickupDisplay, type PickupOrder } from "@/components/restaurant/pickup-display";
import { ScreenGate } from "@/components/restaurant/screen-gate";
import { ApiError } from "@/lib/api/http";
import type { AnnounceLanguage } from "@/lib/restaurant/announce";
import { probeScreen, screenFetch } from "@/lib/restaurant/screen";

/**
 * The customer pickup board: /display/<displayToken>
 *
 * Top-level, deliberately outside both /r/* (middleware would bounce it to the
 * staff login) and /order/* (it would inherit the guest ordering layout and a
 * not-found written around restaurant slugs). Matched by neither middleware
 * branch, so it is public by construction — and then locked by the screen PIN,
 * which is what actually guards it.
 */

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Order pickup",
    // The URL contains a credential. It must never reach an index.
    robots: { index: false, follow: false },
  };
}

export default async function PickupDisplayPage({ params }: { params: { token: string } }) {
  const screen = await probeScreen(params.token);
  if (!screen || screen.kind !== "PICKUP") notFound();

  if (!screen.pinSet) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Almost ready</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This screen is switched on, but the restaurant has not chosen a screen PIN yet. Set one
            under Settings → Screens in the console, then reload this page.
          </p>
        </div>
      </main>
    );
  }

  if (!screen.unlocked) {
    return (
      <ScreenGate
        token={params.token}
        title={screen.restaurantName}
        subtitle="Enter the screen PIN to start the pickup board."
      />
    );
  }

  // Same reasoning as the kitchen screen's own try/catch: pickupEnabled can
  // be turned off after this screen already unlocked, and GET /pickup then
  // 403s where it previously never would have.
  let orders: PickupOrder[];
  let announceLanguages: AnnounceLanguage[];
  try {
    ({ orders, announceLanguages } = await screenFetch<{
      orders: PickupOrder[];
      announceLanguages: AnnounceLanguage[];
    }>(params.token, "/pickup"));
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return <PickupDisabledNotice restaurantName={screen.restaurantName} />;
    }
    throw err;
  }

  return (
    <PickupDisplay
      token={params.token}
      restaurantName={screen.restaurantName}
      branch={screen.branch}
      initialOrders={orders}
      initialAnnounceLanguages={announceLanguages}
    />
  );
}

/** Same dark board styling as the "almost ready" state above — this is a
 * public-facing lobby screen, not the staff console. */
function PickupDisabledNotice({ restaurantName }: { restaurantName: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-neutral-900 text-neutral-400">
          <Monitor className="size-6" />
        </span>
        <h1 className="text-xl font-semibold">Pickup board is disabled</h1>
        <p className="text-sm text-neutral-400">
          {restaurantName} has had its Pickup board turned off. Contact your Priinteve
          administrator if this screen should be active.
        </p>
      </div>
    </main>
  );
}
