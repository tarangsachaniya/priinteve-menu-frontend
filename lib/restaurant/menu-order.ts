import type { PublicMenuCategory, PublicMenuItem } from "@/components/order/types";

/**
 * The order dishes appear in on the customer menu.
 *
 * Categories used to be sections a guest scrolled between. They are now one
 * ordered stream cut into pages, because a menu of two hundred dishes is not
 * browsable as a single scroll and because "move this dish to the last page"
 * needs a last page to exist. The category a dish belongs to still prints as a
 * heading where it first appears, so the structure survives the change.
 */

/** Dishes per page. */
export const MENU_PAGE_SIZE = 20;

/** Below this a "recommended" strip would just be the menu again. */
export const MIN_ITEMS_FOR_RECOMMENDATIONS = 8;

export type FlatMenuItem = PublicMenuItem & {
  categoryId: string;
  categoryName: string;
};

/**
 * Categories collapsed into one stream: category order, then item order within
 * it — the exact sequence the old sections read in, so nothing moves for a
 * restaurant that never touches the new settings.
 *
 * While `isPeak`, dishes the owner flagged `demoteAtPeak` are moved to the very
 * end, keeping their relative order. That is the whole mechanism: last in the
 * stream means last page, and a dish nobody pages to is a dish the kitchen
 * isn't cooking during its rush. Nothing else about them changes — they stay
 * priced, available and orderable, because a guest who wants one should still
 * be able to have one.
 */
export function flattenMenu(
  categories: PublicMenuCategory[],
  { isPeak }: { isPeak: boolean }
): FlatMenuItem[] {
  const ordinary: FlatMenuItem[] = [];
  const demoted: FlatMenuItem[] = [];

  for (const category of categories) {
    for (const item of category.items) {
      const flat: FlatMenuItem = {
        ...item,
        categoryId: category.id,
        categoryName: category.name,
      };
      if (isPeak && item.demoteAtPeak) demoted.push(flat);
      else ordinary.push(flat);
    }
  }

  return [...ordinary, ...demoted];
}

export type MenuFilters = {
  /** Free text over dish name and description. */
  query: string;
  vegOnly: boolean;
  /** Null means every category. */
  categoryId: string | null;
};

/**
 * The filters, applied to the flattened stream.
 *
 * Search deliberately ignores demotion — the stream is already ordered, and a
 * guest who typed a dish's name finds it wherever it sits. Hiding a dish from
 * someone who asked for it by name reads as a broken menu and achieves
 * nothing: they already know it exists.
 */
export function filterMenu(items: FlatMenuItem[], filters: MenuFilters): FlatMenuItem[] {
  const needle = filters.query.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
    if (filters.vegOnly && !item.isVeg) return false;
    if (!needle) return true;
    return (
      item.name.toLowerCase().includes(needle) ||
      (item.description?.toLowerCase().includes(needle) ?? false)
    );
  });
}

/** Total pages for a result set — always at least one, so the pager is stable. */
export function pageCount(total: number, pageSize = MENU_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * One page of results, clamped.
 *
 * A page number past the end returns the last page rather than nothing:
 * filters shrink the result set constantly as a guest types, and a blank
 * screen mid-search reads as "no results" when the truth is "page 4 of 1".
 */
export function pageOf<T>(items: T[], page: number, pageSize = MENU_PAGE_SIZE): T[] {
  const clamped = Math.min(Math.max(1, page), pageCount(items.length, pageSize));
  const start = (clamped - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Where each category heading falls on the page being shown.
 *
 * A heading prints above the first dish of its category *on this page*, which
 * means a category spanning a page break gets its name repeated at the top of
 * the next one — the right behaviour, since the alternative is a page of
 * unlabelled dishes.
 */
export function headingBefore(items: FlatMenuItem[], index: number): string | null {
  if (index === 0) return items[0]?.categoryName ?? null;
  return items[index].categoryId === items[index - 1].categoryId
    ? null
    : items[index].categoryName;
}
