"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { getPageList } from "@/components/ui/pagination";

/**
 * The menu's pager.
 *
 * The page-number sequence is shared with the dashboard's Pagination via
 * getPageList() — collapsing the middle of a long range is the same problem in
 * both places, and solving it twice invites the two from drifting apart. Only
 * the chrome is separate: the dashboard component is built on Button variants
 * that read from the admin theme's tokens, and this surface paints from
 * --resto-* instead.
 *
 * Tap targets are 40px square. This is used almost entirely on phones, held
 * one-handed, by someone who is hungry.
 */
export function MenuPager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  // One page is not a choice, and a pager under it is furniture.
  if (totalPages <= 1) return null;

  const pages = getPageList(page, totalPages);

  return (
    <nav
      aria-label="Menu pages"
      className="mt-8 flex flex-wrap items-center justify-center gap-1.5"
    >
      <PagerButton
        label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </PagerButton>

      {pages.map((entry, index) =>
        entry === "ellipsis" ? (
          <span
            key={`gap-${index}`}
            className="flex size-10 items-center justify-center"
            style={{ color: "var(--resto-text-subtle)" }}
            aria-hidden
          >
            <MoreHorizontal className="size-4" />
          </span>
        ) : (
          <PagerButton
            key={entry}
            label={`Page ${entry}`}
            active={entry === page}
            current={entry === page}
            onClick={() => onPageChange(entry)}
          >
            <span className="resto-numeric text-[13px] font-semibold">{entry}</span>
          </PagerButton>
        )
      )}

      <PagerButton
        label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="size-4" aria-hidden />
      </PagerButton>
    </nav>
  );
}

function PagerButton({
  children,
  label,
  active = false,
  current = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className="flex size-10 shrink-0 items-center justify-center border transition-colors disabled:opacity-40"
      style={{
        backgroundColor: active ? "var(--resto-chip-active-bg)" : "var(--resto-chip-bg)",
        borderColor: active ? "var(--resto-chip-active-border)" : "var(--resto-chip-border)",
        color: active ? "var(--resto-chip-active-text)" : "var(--resto-chip-text)",
        borderRadius: "var(--resto-radius-full)",
      }}
    >
      {children}
    </button>
  );
}
