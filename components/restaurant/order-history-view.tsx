"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { HistorySort } from "@/lib/restaurant/order-history";
import { Card, CardContent } from "@/components/ui/card";
import type { SortState } from "@/components/ui/data-table";
import {
  DishSalesTable,
  type DishSalesRow,
} from "@/components/restaurant/dish-sales-table";
import {
  OrderHistoryFilters,
  type FilterState,
} from "@/components/restaurant/order-history-filters";
import {
  OrderHistoryTable,
  type HistoryRow,
} from "@/components/restaurant/order-history-table";

/**
 * Owns navigation for the whole history page.
 *
 * Every filter, sort, search and page change here is a server round trip, and
 * previously each control called router.push() on its own — so nothing on the
 * page knew a query was in flight and a click on a slow filter looked like a
 * dead button. Routing through one useTransition fixes that at the source: in
 * the App Router the transition stays pending until the *server* has
 * re-rendered, so the spinner below covers the actual query rather than just
 * the client round trip.
 */
export function OrderHistoryView({
  filters,
  currentParams,
  menuItems,
  rows,
  dishRows,
  page,
  totalPages,
  total,
  pageSize,
  sort,
  search,
  summary,
  rangeLabel,
}: {
  filters: FilterState;
  currentParams: string;
  menuItems: { id: string; name: string }[];
  rows: HistoryRow[];
  dishRows: DishSalesRow[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  sort: SortState<HistorySort>;
  search: string;
  summary: { revenue: number; orders: number; cancelled: number };
  rangeLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Stable across renders so the search box's debounce isn't restarted by every
  // re-render this transition causes.
  const navigate = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `/r/history?${query}` : "/r/history");
      });
    },
    [router]
  );

  // The table dims its own rows and keeps its toolbar live; everything else on
  // the page is read-only, so it can dim whole.
  const dimmed = cn("transition-opacity", isPending && "pointer-events-none opacity-60");

  return (
    <div className="flex flex-col gap-6">
      {/* Outside the dimmed region on purpose: someone who changes their mind
          mid-query shouldn't have to wait for the previous one to land. */}
      <OrderHistoryFilters
        filters={filters}
        menuItems={menuItems}
        currentParams={currentParams}
        onNavigate={navigate}
      />

      <Card aria-busy={isPending} className={cn("border-border/80", dimmed)}>
        <CardContent className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <p className="text-2xl font-semibold tracking-tight">
              {formatCurrency(summary.revenue)}
            </p>
            <p className="text-xs text-muted-foreground">Revenue · {rangeLabel}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight">{summary.orders}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight">{summary.cancelled}</p>
            <p className="text-xs text-muted-foreground">Cancelled</p>
          </div>

          {isPending && (
            <span
              role="status"
              className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Updating…
            </span>
          )}
        </CardContent>
      </Card>

      <OrderHistoryTable
        rows={rows}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        sort={sort}
        search={search}
        isPending={isPending}
        currentParams={currentParams}
        onNavigate={navigate}
      />

      <div aria-busy={isPending} className={dimmed}>
        <DishSalesTable rows={dishRows} rangeLabel={rangeLabel} />
      </div>
    </div>
  );
}
