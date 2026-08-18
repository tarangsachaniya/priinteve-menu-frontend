import { redirect } from "next/navigation";
import { History } from "lucide-react";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import type { RestoOrderStatus, RestoOrderType, RestoPaymentStatus } from "@/lib/api/enums";
import { historyQuery, parseHistoryFilters, type HistorySearchParams } from "@/lib/restaurant/order-history";
import { PageShell } from "@/components/shared/page-shell";
import { OrderHistoryView } from "@/components/restaurant/order-history-view";

export const dynamic = "force-dynamic";

type HistoryResponse = {
  menuItems: { id: string; name: string }[];
  total: number;
  totalPages: number;
  summary: { revenue: number; orders: number; cancelled: number };
  rows: {
    id: string;
    orderNumber: number;
    status: RestoOrderStatus;
    type: RestoOrderType;
    paymentStatus: RestoPaymentStatus;
    customerName: string;
    customerMobile: string;
    tableLabel: string | null;
    total: number;
    placedAt: string;
    cancelReason: string | null;
    items: { id: string; name: string; quantity: number; variantName: string | null }[];
  }[];
  dishRows: { name: string; quantity: number; revenue: number; timesOrdered: number }[];
};

/**
 * The records view. The orders board deliberately drops an order the moment
 * it closes, so this is the only place a completed or cancelled order can be
 * looked at again — and the only place a day's takings can be reconciled.
 *
 * Filter parsing happens twice by design: once here (client-side pure
 * function, for building shareable/paginated links via historyQuery()) and
 * once again on the API (GET /api/restaurant/orders/history, which owns the
 * actual query and is the source of truth for what "today" or "this month"
 * means in the restaurant's timezone). Both read the same rules from the
 * same file family, so they can't drift into disagreeing about a range.
 */
export default async function RestaurantHistoryPage({
  searchParams,
}: {
  searchParams: HistorySearchParams;
}) {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  // Menu's own timezone isn't known until the API responds, but historyQuery()
  // only needs the parsed filter *shape* to build query strings — using UTC
  // here for the client-side link builder is harmless since the API redoes
  // this parse authoritatively with the real timezone.
  const filters = parseHistoryFilters(searchParams, "UTC");

  const qs = new URLSearchParams(searchParams as Record<string, string>).toString();
  const data = await serverFetch<HistoryResponse>(`/api/restaurant/orders/history?${qs}`, { cache: "no-store" });

  return (
    <PageShell
      width="wide"
      icon={History}
      title="Order history"
      description="Every past order, cancelled ones included."
    >
      <OrderHistoryView
        filters={{
          preset: filters.preset,
          status: filters.status,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          menuItemId: filters.menuItemId,
        }}
        currentParams={historyQuery(filters)}
        menuItems={data.menuItems}
        rangeLabel={`${filters.fromDate} to ${filters.toDate}`}
        search={filters.q}
        sort={{ key: filters.sort, dir: filters.dir }}
        pageSize={filters.pageSize}
        total={data.total}
        summary={data.summary}
        rows={data.rows}
        dishRows={data.dishRows}
        page={filters.page}
        totalPages={data.totalPages}
      />
    </PageShell>
  );
}
