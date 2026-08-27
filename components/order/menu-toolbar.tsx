"use client";

import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PublicMenuCategory } from "@/components/order/types";

/**
 * Search, the veg filter and the category chips.
 *
 * Filtering is client-side: a menu is small and already fully loaded, so a
 * round trip per keystroke would be slower and would fail on the patchy
 * connections this page is usually opened over.
 *
 * The chips *filter* the list rather than scrolling to a section. They used to
 * be scroll anchors, back when the menu was one long stack of category
 * sections; now that it is paged, an anchor would jump to a heading that may
 * not be on the current page at all. "All" leads, so the way back is always
 * one tap and always in the same place.
 *
 * The chips' active state is driven by --resto-chip-* tokens rather than
 * classes, so the accent decision stays in one place — see section 6 of
 * app/resto-theme.css.
 */
export function MenuToolbar({
  categories,
  query,
  onQueryChange,
  vegOnly,
  onVegOnlyChange,
  categoryFilter,
  onCategoryFilterChange,
}: {
  categories: PublicMenuCategory[];
  query: string;
  onQueryChange: (value: string) => void;
  vegOnly: boolean;
  onVegOnlyChange: (value: boolean) => void;
  /** Null means every category. */
  categoryFilter: string | null;
  onCategoryFilterChange: (id: string | null) => void;
}) {
  // A restaurant with no non-veg dish at all has nothing for the toggle to
  // filter out — showing it anyway would just be a switch that does nothing,
  // and would wrongly imply the kitchen serves non-veg somewhere it doesn't.
  const hasNonVegItem = categories.some((category) =>
    category.items.some((item) => !item.isVeg)
  );

  return (
    <div
      className="border-b"
      style={{
        backgroundColor: "var(--resto-bg)",
        borderColor: "var(--resto-border)",
      }}
    >
      <div className="mx-auto w-full max-w-[var(--resto-measure)] space-y-3 px-4 py-3">
        {/* flex-wrap rather than relying on the search box shrinking enough:
            on a narrow phone, "Veg" clipping against the edge is worse than
            the toggle simply dropping to its own line. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              style={{ color: "var(--resto-text-subtle)" }}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search for dishes, e.g. paneer"
              aria-label="Search the menu"
              className="h-11 w-full border pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-[var(--resto-text-subtle)]"
              style={{
                backgroundColor: "var(--resto-card)",
                borderColor: "var(--resto-border)",
                borderRadius: "var(--resto-radius-full)",
                boxShadow: "var(--resto-shadow-card)",
                color: "var(--resto-text)",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full"
                style={{ color: "var(--resto-text-muted)" }}
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          {hasNonVegItem && <VegToggle checked={vegOnly} onChange={onVegOnlyChange} />}
        </div>

        {categories.length > 1 && (
          <div
            className="resto-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
            role="tablist"
            aria-label="Filter by category"
          >
            <CategoryChip
              label="All"
              isActive={categoryFilter === null}
              onClick={() => onCategoryFilterChange(null)}
            />
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                isActive={categoryFilter === category.id}
                // Tapping the live chip clears it. Without that, a guest who
                // filtered by mistake has to find "All" to get back, and on a
                // scrolled chip row it may be off-screen.
                onClick={() =>
                  onCategoryFilterChange(categoryFilter === category.id ? null : category.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className="shrink-0 border px-3 py-1 text-[13px] font-medium transition-colors"
      style={{
        backgroundColor: isActive ? "var(--resto-chip-active-bg)" : "var(--resto-chip-bg)",
        color: isActive ? "var(--resto-chip-active-text)" : "var(--resto-chip-text)",
        borderColor: isActive ? "var(--resto-chip-active-border)" : "var(--resto-chip-border)",
        borderRadius: "var(--resto-radius-full)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * The veg filter is a switch, not a chip: it is a persistent dietary
 * constraint rather than a browsing choice, and for many guests it is the
 * first thing they set and never touch again.
 */
function VegToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex h-11 shrink-0 items-center gap-2 border px-3"
      style={{
        backgroundColor: "var(--resto-card)",
        borderColor: checked ? "var(--resto-veg)" : "var(--resto-border)",
        borderRadius: "var(--resto-radius-full)",
        color: "var(--resto-text)",
      }}
    >
      <span
        className={cn("relative h-5 w-9 rounded-full transition-colors")}
        style={{ backgroundColor: checked ? "var(--resto-veg)" : "var(--resto-surface-alt)" }}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
      <span className="text-[13px] font-medium">Veg</span>
    </button>
  );
}
