"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";

/**
 * The chrome that turns a plain <Table> into a data table: a length menu, a
 * search box, sortable headers and a "showing 1–25 of 312" line.
 *
 * Deliberately headless about *where* the work happens. A table small enough to
 * ship whole to the browser sorts and filters in local state; one that is
 * server-paginated hands the same props to the URL instead. Both get the same
 * controls, so the two history tables behave identically even though only one
 * of them can answer a sort without a round trip.
 */

export type SortDirection = "asc" | "desc";

export type SortState<K extends string = string> = {
  key: K;
  dir: SortDirection;
};

/** Row counts offered by the length menu. */
export const DATA_TABLE_PAGE_SIZES = [10, 25, 50, 100];

/**
 * What a header click means: re-clicking the sorted column flips it, moving to
 * a new column starts at that column's natural direction — ascending for names,
 * descending for money and dates, where the interesting end is the big one.
 */
export function nextSort<K extends string>(
  current: SortState<K>,
  key: K,
  startDir: SortDirection = "asc"
): SortState<K> {
  if (current.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key, dir: startDir };
}

/** Sort comparator for client-side tables. Numbers compare numerically. */
export function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function SortableHead<K extends string>({
  columnKey,
  sort,
  onSort,
  align = "left",
  className,
  children,
}: {
  columnKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const active = sort.key === columnKey;
  const Indicator = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    // aria-sort is what tells a screen reader the table is sorted and by which
    // column — the arrow glyph alone says nothing.
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("p-0", className)}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          "flex h-11 w-full items-center gap-1.5 px-3.5 text-xs font-semibold tracking-wide uppercase transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          align === "right" && "justify-end",
          active && "text-foreground"
        )}
      >
        {children}
        <Indicator className={cn("size-3.5 shrink-0", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

export function DataTableSearch({
  value,
  onChange,
  placeholder,
  maxLength,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={maxLength}
        className="h-9 bg-card pl-9"
      />
    </div>
  );
}

export function DataTableLengthMenu({
  value,
  onChange,
  options = DATA_TABLE_PAGE_SIZES,
}: {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
}) {
  return (
    <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
      Show
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 rounded-xl border border-border bg-card px-2 text-sm text-foreground"
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      rows
    </label>
  );
}

/**
 * "Showing 26–50 of 312 orders". The count is the part that matters: with a
 * filter and a search both applied, the number of rows on screen no longer
 * tells anyone how much matched.
 */
export function DataTableInfo({
  page,
  pageSize,
  total,
  noun,
  filtered = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Plural noun for the rows, e.g. "orders". */
  noun: string;
  /** True when a search is narrowing the set, so the count can say so. */
  filtered?: boolean;
}) {
  const suffix = filtered ? ` matching ${noun}` : ` ${noun}`;

  return (
    <p role="status" className="text-xs tabular-nums text-muted-foreground">
      {total === 0
        ? `No${suffix}`
        : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}${suffix}`}
    </p>
  );
}

/** Keeps the table's shape — and its toolbar — on screen when nothing matched. */
export function DataTableEmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-14 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}
