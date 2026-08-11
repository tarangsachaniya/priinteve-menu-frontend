import type { RestoItemBadge } from "@/lib/api/enums";

/**
 * Formatting for the presentation fields the customer template renders.
 *
 * Every helper returns null when there is nothing worth showing, so the UI can
 * omit a block rather than render an empty one — a restaurant that filled in
 * half the form still looks deliberate.
 */

/** Stored ×10 (see Restaurant.ratingValue); read back as "4.7". */
export function formatRating(value: number | null | undefined): string | null {
  if (value == null) return null;
  return (value / 10).toFixed(1);
}

/** "2,148" — the review count beside a rating. */
export function formatRatingCount(count: number | null | undefined): string | null {
  if (count == null) return null;
  return new Intl.NumberFormat("en-IN").format(count);
}

/** "30–40 min", or "30 min" when only one bound is set. */
export function formatPrepTime(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  if (min != null && max != null) return min === max ? `${min} min` : `${min}–${max} min`;
  const single = min ?? max;
  return single == null ? null : `${single} min`;
}

/** "₹900 for two". Deliberately not formatCurrency: no decimals, no space. */
export function formatCostForTwo(value: number | null | undefined): string | null {
  return value == null ? null : `₹${new Intl.NumberFormat("en-IN").format(value)} for two`;
}

/**
 * One dish's serve time — "~25 min".
 *
 * The tilde is doing real work: this is the kitchen's rough figure, and a bare
 * "25 min" reads as a promise. Zero is treated as unset for the same reason
 * null is — a dish that arrives instantly is not a claim any kitchen makes.
 */
export function formatServeTime(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null;
  return `~${minutes} min`;
}

/**
 * How long a whole order should take.
 *
 * The *maximum*, never the sum. A kitchen cooks in parallel, so six dishes
 * take as long as the slowest one, and adding them up would quote three hours
 * for a table of six — a number so wrong the guest stops believing any of it.
 *
 * Returns null when nothing in the order has a quoted time, so the caller can
 * omit the line rather than print an estimate built from no data.
 */
export function estimateOrderMinutes(
  items: { prepMinutes: number | null | undefined }[]
): number | null {
  const quoted = items
    .map((item) => item.prepMinutes)
    .filter((minutes): minutes is number => minutes != null && minutes > 0);

  return quoted.length === 0 ? null : Math.max(...quoted);
}

/** "Ready in about 30 min" — the order-level line in the cart and on status. */
export function formatOrderEstimate(minutes: number | null): string | null {
  return minutes == null ? null : `Ready in about ${minutes} min`;
}

export const ITEM_BADGE_LABEL: Record<RestoItemBadge, string> = {
  BESTSELLER: "Bestseller",
  CHEFS_PICK: "Chef's pick",
  POPULAR: "Popular",
  NEW: "New",
};

export const ITEM_BADGE_OPTIONS: { value: RestoItemBadge; label: string }[] = (
  Object.keys(ITEM_BADGE_LABEL) as RestoItemBadge[]
).map((value) => ({ value, label: ITEM_BADGE_LABEL[value] }));
