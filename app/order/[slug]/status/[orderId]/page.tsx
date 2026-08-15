import type { Metadata } from "next";

import { API_INTERNAL_URL } from "@/lib/api/config";
import { apiRequest } from "@/lib/api/http";
import type { RestoOrderStatus, RestoOrderType, RestoPaymentMode, RestoPaymentStatus } from "@/lib/api/enums";
import type { AnnounceLanguage } from "@/lib/restaurant/announce";
import { ClosedNotice } from "@/components/order/closed-notice";
import { OrderStatusTracker } from "@/components/order/order-status-tracker";
import { RestoPage } from "@/components/order/resto-page";

export const dynamic = "force-dynamic";

type OrderPageDTO = {
  id: string;
  orderNumber: number;
  status: RestoOrderStatus;
  paymentStatus: RestoPaymentStatus;
  paymentMode: RestoPaymentMode | null;
  type: RestoOrderType;
  tableLabel: string | null;
  customerName: string;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
  cancelReason: string | null;
  placedAt: string;
  items: { id: string; name: string; quantity: number; lineTotal: number; variantName: string | null; prepMinutes: number | null; addOns: string[] }[];
  restaurantName: string;
  restaurantSlug: string;
  brandColor: string;
  themeMode: string;
  /** Which languages to speak "your order is ready" in — same set and order the pickup board uses. */
  announceLanguages: AnnounceLanguage[];
  canPayOnline: boolean;
  canPayCash: boolean;
  canPayUpiQr: boolean;
  hasReview: boolean;
};

async function loadOrderPage(slug: string, orderId: string): Promise<OrderPageDTO | null> {
  const result = await apiRequest<{ order: OrderPageDTO }>(
    API_INTERNAL_URL,
    `/api/order/${orderId}/page?slug=${encodeURIComponent(slug)}`,
    { cache: "no-store", allow404: true },
  );
  return result?.order ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; orderId: string };
}): Promise<Metadata> {
  const order = await loadOrderPage(params.slug, params.orderId);
  if (!order) return { title: "Order not found" };
  return { title: `Order #${order.orderNumber} · ${order.restaurantName}` };
}

/**
 * Live status for one order. `status` is a static segment, so it always wins
 * over the sibling [tableCode] route — "status" is reserved as a table code
 * in the API's codes.ts to keep it that way.
 *
 * canPayOnline/canPayCash/canPayUpiQr are computed API-side (they depend on
 * isRazorpayConfigured(), which is server-only environment) — see
 * GET /api/order/:orderId/page.
 */
export default async function OrderStatusPage({
  params,
}: {
  params: { slug: string; orderId: string };
}) {
  const order = await loadOrderPage(params.slug, params.orderId);

  if (!order) {
    return (
      <ClosedNotice
        title="Order not found"
        message="We couldn't find this order. Check the link, or ask the restaurant for help."
      />
    );
  }

  return (
    <RestoPage slug={order.restaurantSlug} brandColor={order.brandColor} themeMode={order.themeMode}>
      <OrderStatusTracker order={order} />
    </RestoPage>
  );
}
