import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import type { LiveOrder } from "@/lib/restaurant/live-order";
import { PageHeader } from "@/components/shared/page-header";
import { OrdersBoard } from "@/components/restaurant/orders-board";

export const dynamic = "force-dynamic";

export default async function RestaurantOrdersPage() {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  const { orders } = await serverFetch<{ orders: LiveOrder[] }>("/api/restaurant/orders", { cache: "no-store" });

  return (
    <main className="mx-auto max-w-7xl p-6 sm:p-8 lg:p-10">
      <PageHeader
        icon={ReceiptText}
        title="Orders"
        description="Live kitchen board — move each order along as you work through it."
      />

      <OrdersBoard initialOrders={orders} />
    </main>
  );
}
