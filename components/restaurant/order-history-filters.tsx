"use client";

import { Download } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  HISTORY_PRESETS,
  HISTORY_STATUSES,
  type HistoryPreset,
  type HistoryStatus,
} from "@/lib/restaurant/order-history";
import { Button } from "@/components/ui/button";

export type FilterState = {
  preset: HistoryPreset;
  status: HistoryStatus;
  fromDate: string;
  toDate: string;
  menuItemId: string | null;
};

/**
 * Every filter is a navigation, not local state: the range an owner is looking
 * at belongs in the URL so it can be bookmarked, shared, and — the reason it
 * matters most here — handed to the CSV export unchanged.
 */
export function OrderHistoryFilters({
  filters,
  menuItems,
  currentParams,
  onNavigate,
}: {
  filters: FilterState;
  menuItems: { id: string; name: string }[];
  /** Everything currently in the URL, including the table's own sort and search. */
  currentParams: string;
  /** Navigation is owned by the view, so one transition covers the whole page. */
  onNavigate: (params: URLSearchParams) => void;
}) {
  function apply(changes: Partial<Record<string, string | null>>) {
    // Built from the live query string rather than from scratch, so changing
    // the date range doesn't quietly throw away the column sort, the row count
    // and the search term the person had set.
    const params = new URLSearchParams(currentParams);
    const next = {
      preset: filters.preset,
      status: filters.status,
      from: filters.preset === "custom" ? filters.fromDate : null,
      to: filters.preset === "custom" ? filters.toDate : null,
      menuItemId: filters.menuItemId,
      ...changes,
    };

    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Any filter change invalidates the page number — page 3 of the old range
    // is meaningless in the new one.
    params.delete("page");

    onNavigate(params);
  }

  // The export is the current view as a file, so it carries the same query —
  // minus the page, since one page of a range is not an export.
  const exportQuery = new URLSearchParams(currentParams);
  exportQuery.delete("page");
  exportQuery.delete("pageSize");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* max-w-full + scroll: the four presets measure ~320px, which is wider
            than a 320–360px phone once the page padding is taken off, and the
            row had neither wrap nor scroll — so it pushed the whole page into a
            horizontal scroll. Scrolling the strip beats wrapping it: these read
            as one segmented control and a wrapped second line looks broken. */}
        <nav
          aria-label="Date range"
          className="scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
        >
          {HISTORY_PRESETS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                apply(
                  key === "custom"
                    ? { preset: key, from: filters.fromDate, to: filters.toDate }
                    : { preset: key, from: null, to: null }
                )
              }
              aria-pressed={filters.preset === key}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                filters.preset === key
                  ? "bg-card shadow-sm"
                  : // Matches the status pills below, which already had this:
                    // transition-colors with nothing to transition to left the
                    // inactive presets reading as static labels, not buttons.
                    "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          render={<a href={`/api/restaurant/orders/export?${exportQuery.toString()}`} />}
        >
          <Download data-icon="inline-start" />
          Download CSV
        </Button>
      </div>

      {filters.preset === "custom" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            From
            <input
              type="date"
              value={filters.fromDate}
              max={filters.toDate}
              onChange={(e) => apply({ preset: "custom", from: e.target.value })}
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            To
            <input
              type="date"
              value={filters.toDate}
              min={filters.fromDate}
              onChange={(e) => apply({ preset: "custom", to: e.target.value })}
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {HISTORY_STATUSES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => apply({ status: key })}
            aria-pressed={filters.status === key}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filters.status === key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}

        {menuItems.length > 0 && (
          <select
            aria-label="Filter by dish"
            value={filters.menuItemId ?? ""}
            onChange={(e) => apply({ menuItemId: e.target.value || null })}
            /* A <select> sizes itself to its widest <option> and, as a flex
               item, defaults to min-width:auto — so it refuses to shrink. One
               long dish name ("Paneer Butter Masala with Extra Cheese") was
               enough to push the row past a phone viewport and scroll the page
               sideways. min-w-0 lets it shrink, max-w caps it on desktop. */
            className="ml-auto h-9 w-full min-w-0 max-w-[14rem] rounded-xl border border-border bg-card px-3 text-sm text-foreground sm:w-auto"
          >
            <option value="">All dishes</option>
            {menuItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
