import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import type { RestoOrderStatus, RestoOrderType, RestoPaymentMode, RestoPaymentStatus } from "@/lib/api/enums";
import { PageHeader } from "@/components/shared/page-header";
import { OrdersBoard } from "@/components/restaurant/orders-board";

export const dynamic = "force-dynamic";

type LiveOrder = {
  id: string;
  orderNumber: number;
  status: RestoOrderStatus;
  type: RestoOrderType;
  paymentMode: RestoPaymentMode | null;
  paymentStatus: RestoPaymentStatus;
  customerName: string;
  customerMobile: string;
  tableLabel: string | null;
  total: number;
  note: string | null;
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  pickupInMinutes: number | null;
  placedAt: string;
  items: { id: string; name: string; quantity: number; lineTotal: number; variantName: string | null; addOns: string[] }[];
};

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
