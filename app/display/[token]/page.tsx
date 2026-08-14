import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PickupDisplay } from "@/components/restaurant/pickup-display";
import { ScreenGate } from "@/components/restaurant/screen-gate";
import type { RestoOrderStatus } from "@/lib/api/enums";
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

  const { orders, announceLanguages } = await screenFetch<{
    orders: { orderNumber: number; status: RestoOrderStatus }[];
    announceLanguages: AnnounceLanguage[];
  }>(params.token, "/pickup");

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
