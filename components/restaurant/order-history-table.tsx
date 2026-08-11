"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import type { RestoOrderStatus, RestoOrderType, RestoPaymentStatus } from "@/lib/api/enums";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { formatMobile } from "@/lib/restaurant/mobile";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/restaurant/order-status";
import {
  HISTORY_PAGE_SIZES,
  HISTORY_SEARCH_MAX_LENGTH,
  type HistorySort,
  type SortDirection,
} from "@/lib/restaurant/order-history";
import { Pagination } from "@/components/ui/pagination";
import {
  DataTableEmptyRow,
  DataTableInfo,
  DataTableLengthMenu,
  DataTableSearch,
  SortableHead,
  nextSort,
  type SortState,
} from "@/components/ui/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type HistoryRow = {
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
};

/** Number of columns, for the empty row's colSpan. */
const COLUMN_COUNT = 9;

/**
 * Which way a column opens on its first click. A name is looked up
 * alphabetically; a date, an order number and a total are all asked about from
 * the big end first, so starting those ascending would waste the click.
 */
const SORT_START: Record<HistorySort, SortDirection> = {
  orderNumber: "desc",
  placedAt: "desc",
  customerName: "asc",
  type: "asc",
  status: "asc",
  paymentStatus: "asc",
  total: "desc",
};

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Past orders as a data table: sortable columns, a search box, a length menu
 * and a row count, over the board's read-only cards.
 *
 * Sorting and searching run on the server, not on `rows`. Only one page is in
 * the browser at a time, so a client-side sort would silently reorder 25 rows
 * and call it "sorted by total" while the biggest order of the week sat on page
 * four. Every control here is therefore a navigation, which also means the view
 * someone is looking at survives a reload and pastes into a message intact.
 */
export function OrderHistoryTable({
  rows,
  page,
  totalPages,
  total,
  pageSize,
  sort,
  search,
  isPending,
  currentParams,
  onNavigate,
}: {
  rows: HistoryRow[];
  page: number;
  totalPages: number;
  /** Matching orders across every page, not just the ones rendered. */
  total: number;
  pageSize: number;
  sort: SortState<HistorySort>;
  search: string;
  /** A query is in flight; dim the rows but leave the toolbar usable. */
  isPending: boolean;
  /** The filters currently in the URL, so every control preserves the rest. */
  currentParams: string;
  onNavigate: (params: URLSearchParams) => void;
}) {
  const [term, setTerm] = useState(search);

  // Re-sync when the URL moves under us — the back button, or a filter reset.
  useEffect(() => {
    setTerm(search);
  }, [search]);

  // Typing shouldn't fire a query per keystroke, so the navigation waits for a
  // pause. Bailing when the term already matches the URL keeps the mount, and
  // every re-render after a landed query, from pushing a duplicate entry.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === search) return;

    const handle = setTimeout(() => {
      const params = new URLSearchParams(currentParams);
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      onNavigate(params);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [term, search, currentParams, onNavigate]);

  /** Anything that changes which rows match invalidates the page number. */
  function navigateWith(changes: Record<string, string | null>) {
    const params = new URLSearchParams(currentParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    onNavigate(params);
  }

  function toggleSort(key: HistorySort) {
    const next = nextSort(sort, key, SORT_START[key]);
    navigateWith({ sort: next.key, dir: next.dir });
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(currentParams);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    onNavigate(params);
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Outside the dimmed region on purpose: someone who mistyped a search
          shouldn't have to wait for the wrong query to land before fixing it. */}
      <div className="flex flex-wrap items-center gap-3">
        <DataTableSearch
          value={term}
          onChange={setTerm}
          placeholder="Search order no., customer, mobile or dish"
          maxLength={HISTORY_SEARCH_MAX_LENGTH}
        />
        <div className="ml-auto">
          <DataTableLengthMenu
            value={pageSize}
            onChange={(size) => navigateWith({ pageSize: String(size) })}
            options={HISTORY_PAGE_SIZES}
          />
        </div>
      </div>

      <div
        aria-busy={isPending}
        className={cn(
          "flex flex-col gap-3 transition-opacity",
          isPending && "pointer-events-none opacity-60"
        )}
      >
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead columnKey="orderNumber" sort={sort} onSort={toggleSort}>
                  Order
                </SortableHead>
                <SortableHead columnKey="placedAt" sort={sort} onSort={toggleSort}>
                  Placed
                </SortableHead>
                <SortableHead columnKey="customerName" sort={sort} onSort={toggleSort}>
                  Customer
                </SortableHead>
                {/* Items live in another table, one row per line — there is no
                    single value to order the orders by. */}
                <TableHead>Items</TableHead>
                <SortableHead columnKey="type" sort={sort} onSort={toggleSort}>
                  Type
                </SortableHead>
                <SortableHead columnKey="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHead>
                <SortableHead columnKey="paymentStatus" sort={sort} onSort={toggleSort}>
                  Payment
                </SortableHead>
                <SortableHead columnKey="total" sort={sort} onSort={toggleSort} align="right">
                  Total
                </SortableHead>
                {/* Unsortable and unlabelled — an action column, not data. */}
                <TableHead className="w-10" aria-label="Bill" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <DataTableEmptyRow colSpan={COLUMN_COUNT}>
                  {search ? `No orders match “${search}”.` : "No orders in this range."}
                </DataTableEmptyRow>
              )}

              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium tabular-nums">#{row.orderNumber}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(row.placedAt)}
                  </TableCell>
                  <TableCell>
                    <span className="block break-words">{row.customerName}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {formatMobile(row.customerMobile)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[22rem]">
                    <span className="block break-words text-xs text-muted-foreground">
                      {row.items
                        .map(
                          (item) =>
                            `${item.quantity}× ${item.name}` +
                            (item.variantName ? ` (${item.variantName})` : "")
                        )
                        .join(", ")}
                    </span>
                    {/* Why an order was cancelled is the whole reason to look it
                        up later, and the board never surfaced it. */}
                    {row.cancelReason && (
                      <span className="mt-0.5 block break-words text-xs text-destructive">
                        {row.cancelReason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {ORDER_TYPE_LABEL[row.type]}
                    {row.tableLabel ? ` · ${row.tableLabel}` : ""}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                        ORDER_STATUS_BADGE[row.status]
                      )}
                    >
                      {ORDER_STATUS_LABEL[row.status]}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {PAYMENT_STATUS_LABEL[row.paymentStatus]}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {formatCurrency(row.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`/api/restaurant/orders/${row.id}/invoice`}
                      download
                      aria-label={`Download the bill for order ${row.orderNumber}`}
                      title="Download bill"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Receipt className="size-4" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataTableInfo
            page={page}
            pageSize={pageSize}
            total={total}
            noun="orders"
            filtered={Boolean(search)}
          />
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
          )}
        </div>
      </div>
    </section>
  );
}
