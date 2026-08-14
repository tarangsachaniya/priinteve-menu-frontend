import type { Metadata } from "next";
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

  const { orders } = await serverFetch<{ orders: LiveOrder[] }>("/api/restaurant/orders", {
    cache: "no-store",
  });

  return <KitchenDisplay initialOrders={orders} />;
}
