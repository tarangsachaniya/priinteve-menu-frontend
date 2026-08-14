import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KitchenScreen } from "@/components/restaurant/kitchen-screen";
import { ScreenGate } from "@/components/restaurant/screen-gate";
import type { KitchenOrder } from "@/lib/restaurant/live-order";
import { probeScreen, screenFetch } from "@/lib/restaurant/screen";

/**
 * The mounted kitchen display: /kds/<kitchenToken>
 *
 * TOP-LEVEL, DELIBERATELY. Under /r/* middleware.ts would bounce it to
 * /r/login, which is the one thing this route must never need — the tablet by
 * the pass has no staff session and must not be given one. Its credentials are
 * the unguessable link segment plus the restaurant's screen PIN.
 *
 * The staff-facing twin at /r/kitchen renders the same board from inside the
 * console. Two doors, one room: a manager already signed in should not have to
 * type a PIN to glance at the kitchen, and a wall tablet should not carry a
 * session that opens Settings.
 */

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Kitchen screen",
    // The URL contains a credential. It must never reach an index.
    robots: { index: false, follow: false },
  };
}

export default async function KitchenScreenPage({ params }: { params: { token: string } }) {
  const screen = await probeScreen(params.token);
  // Unknown, rotated, disabled, or the pickup board's link — all one 404, so a
  // guesser learns nothing from which of their guesses got a different answer.
  if (!screen || screen.kind !== "KITCHEN") notFound();

  if (!screen.pinSet) {
    return <NoPinYet />;
  }

  if (!screen.unlocked) {
    return (
      <ScreenGate
        token={params.token}
        title={screen.restaurantName}
        subtitle="Enter the screen PIN to start the kitchen display."
      />
    );
  }

  const { orders } = await screenFetch<{ orders: KitchenOrder[] }>(params.token, "/orders");

  return (
    <KitchenScreen
      token={params.token}
      restaurantName={screen.restaurantName}
      initialOrders={orders}
    />
  );
}

/**
 * The link is live but no PIN exists, so the keypad could never open. Saying so
 * saves whoever is holding the tablet ten minutes of typing guesses at a lock
 * with nothing behind it.
 */
function NoPinYet() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-ink">Almost ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen is switched on, but the restaurant has not chosen a screen PIN yet. Set one
          under Settings → Screens in the console, then reload this page.
        </p>
      </div>
    </main>
  );
}
