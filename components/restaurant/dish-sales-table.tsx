"use client";

import { useMemo, useState } from "react";

import { formatCurrency } from "@/lib/format";
import {
  DataTableEmptyRow,
  DataTableInfo,
  DataTableLengthMenu,
  DataTableSearch,
  SortableHead,
  compareValues,
  nextSort,
  type SortDirection,
  type SortState,
} from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DishSalesRow = {
  name: string;
  quantity: number;
  revenue: number;
  /** Order *lines*, not distinct orders — see the column note below. */
  timesOrdered: number;
};

type DishSort = keyof DishSalesRow;

const COLUMN_COUNT = 4;

const SORT_START: Record<DishSort, SortDirection> = {
  name: "asc",
  quantity: "desc",
  timesOrdered: "desc",
  revenue: "desc",
};

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * What actually sold in the selected range, dish by dish.
 *
 * The order list answers "what happened to #42"; this answers "how many of
 * these did we sell", which is the question that changes a menu.
 *
 * Unlike the order table, this one sorts and searches in the browser: the whole
 * report is one row per dish on the menu and already in memory, so a round trip
 * would buy nothing and cost the instant re-sort that makes a table like this
 * worth reading. The footer totals the *matched* rows, not the visible page —
 * a total that changed when you turned the page would be worse than none.
 */
export function DishSalesTable({ rows, rangeLabel }: { rows: DishSalesRow[]; rangeLabel: string }) {
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<SortState<DishSort>>({ key: "revenue", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const matched = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((row) => row.name.toLowerCase().includes(needle))
      : rows;

    return [...filtered].sort((a, b) => {
      const result = compareValues(a[sort.key], b[sort.key]);
      return sort.dir === "asc" ? result : -result;
    });
  }, [rows, term, sort]);

  const totals = useMemo(
    () =>
      matched.reduce(
        (acc, row) => ({
          quantity: acc.quantity + row.quantity,
          timesOrdered: acc.timesOrdered + row.timesOrdered,
          revenue: acc.revenue + row.revenue,
        }),
        { quantity: 0, timesOrdered: 0, revenue: 0 }
      ),
    [matched]
  );

  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  // Clamped rather than reset in an effect: a page that no longer exists after
  // a search should render the last one that does, not an empty table.
  const currentPage = Math.min(page, totalPages);
  const visible = matched.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: DishSort) {
    setSort((current) => nextSort(current, key, SORT_START[key]));
    setPage(1);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Dish sales</h2>
          <p className="text-xs text-muted-foreground">
            {rangeLabel} · cancelled orders excluded, since a cancelled dish was never sold.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DataTableSearch
            value={term}
            onChange={(value) => {
              setTerm(value);
              setPage(1);
            }}
            placeholder="Search dishes"
            className="sm:w-56"
          />
          <DataTableLengthMenu
            value={pageSize}
            onChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            options={PAGE_SIZES}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead columnKey="name" sort={sort} onSort={toggleSort}>
                Dish
              </SortableHead>
              <SortableHead columnKey="quantity" sort={sort} onSort={toggleSort} align="right">
                Qty sold
              </SortableHead>
              {/* Lines, not orders: one order taking the same dish in two
                  sizes is two lines. */}
              <SortableHead columnKey="timesOrdered" sort={sort} onSort={toggleSort} align="right">
                Times ordered
              </SortableHead>
              <SortableHead columnKey="revenue" sort={sort} onSort={toggleSort} align="right">
                Revenue
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <DataTableEmptyRow colSpan={COLUMN_COUNT}>
                {rows.length === 0
                  ? "No dishes sold in this range."
                  : `No dishes match “${term.trim()}”.`}
              </DataTableEmptyRow>
            )}

            {visible.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="break-words font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.timesOrdered}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          {matched.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableHead className="text-foreground">
                  Total{term.trim() ? " (matched)" : ""}
                </TableHead>
                <TableCell className="text-right font-semibold tabular-nums">
                  {totals.quantity}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {totals.timesOrdered}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(totals.revenue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataTableInfo
          page={currentPage}
          pageSize={pageSize}
          total={matched.length}
          noun="dishes"
          filtered={Boolean(term.trim())}
        />
        {totalPages > 1 && (
          <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </section>
  );
}
