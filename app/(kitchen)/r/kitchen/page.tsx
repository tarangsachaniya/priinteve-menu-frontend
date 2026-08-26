import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { redirect } from "next/navigation";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import type { LiveOrder } from "@/lib/restaurant/live-order";
import { KitchenDisplay } from "@/components/restaurant/kitchen-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kitchen",
};

export default async function KitchenPage() {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  // GET /api/restaurant/orders isn't itself gated on kitchenEnabled — the
  // module toggle is enforced here, at the route the nav link hides, so a
  // direct visit to /r/kitchen after an admin turns Kitchen off still shows a
  // clear reason instead of a board with nothing acting on it.
  if (!sessionData.restaurant.kitchenEnabled) {
    return <KitchenDisabledNotice />;
  }

  const { orders } = await serverFetch<{ orders: LiveOrder[] }>("/api/restaurant/orders", {
    cache: "no-store",
  });

  return <KitchenDisplay initialOrders={orders} />;
}

function KitchenDisabledNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-card text-muted-foreground">
          <ChefHat className="size-6" />
        </span>
        <h1 className="text-xl font-semibold text-ink">Kitchen is disabled</h1>
        <p className="text-sm text-muted-foreground">
          Your Priinteve administrator has turned the Kitchen board off for this restaurant.
          Contact them if you need it back.
        </p>
      </div>
    </main>
  );
}
