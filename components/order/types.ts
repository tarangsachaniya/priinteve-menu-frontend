import type { RestoItemBadge, RestoOrderType, RestoPaymentMode } from "@/lib/api/enums";

import type { DayHours, OpenState } from "@/lib/restaurant/hours";
import type { PeakState } from "@/lib/restaurant/peak-hours";
import type { ReviewSummary } from "@/lib/restaurant/reviews";

/** Shared shapes for the customer ordering surface. */

export type PublicVariant = {
  id: string;
  name: string;
  /** Adjusts the item price rather than replacing it; may be negative. */
  priceDelta: number;
  isDefault: boolean;
};

export type PublicAddOn = {
  id: string;
  name: string;
  price: number;
};

export type PublicMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  badge: RestoItemBadge | null;
  /** Stored ×10 — format with formatRating(). */
  ratingValue: number | null;
  /** Approximate minutes to plate; null when the owner quoted none. */
  prepMinutes: number | null;
  /**
   * Owner-flagged as a rush bottleneck. Only ever read by flattenMenu() to
   * sort the dish last while peak is on — the card never renders it, because
   * from the guest's side nothing about the dish has changed.
   */
  demoteAtPeak: boolean;
  /** Available options only; a sold-out variant never reaches the customer. */
  variants: PublicVariant[];
  addOns: PublicAddOn[];
};

export type PublicMenuCategory = {
  id: string;
  name: string;
  description: string | null;
  items: PublicMenuItem[];
};

export type PublicRestaurant = {
  name: string;
  branch: string | null;
  slug: string;
  address: string | null;
  phone: string | null;
  brandColor: string;
  themeMode: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  tagline: string | null;
  description: string | null;
  cuisineTags: string[];
  prepTimeMinMins: number | null;
  prepTimeMaxMins: number | null;
  costForTwo: number | null;
  ratingValue: number | null;
  ratingCount: number | null;
  taxPercent: number;
  deliveryFee: number;
  minOrderValue: number;
  orderTypes: RestoOrderType[];
  paymentModes: RestoPaymentMode[];
  /** Resolved server-side so the badge and the order API can never disagree. */
  openState: OpenState;
  /**
   * Whether the kitchen is in a declared rush. Drives dish order only — see
   * flattenMenu(). Never surfaced to the guest: from their side the menu is
   * simply a menu, and telling them the kitchen is busy would only invite
   * them to leave.
   */
  peakState: PeakState;
  /** The full week, for the "see all hours" panel. Empty means always open. */
  hours: DayHours[];
  /** The restaurant's own clock — hours are read in this zone, not the guest's. */
  timezone: string;
  /** Real guest reviews, published only past the threshold. */
  reviewSummary: ReviewSummary;
};

export type PublicTable = {
  code: string;
  label: string;
};

/**
 * One row of the cart.
 *
 * `key` rather than the item id is the identity: the same dish ordered large
 * with extra cheese and again regular is two lines, not one. Built by
 * cartLineKey() in use-cart.ts.
 */
export type CartLine = {
  key: string;
  item: PublicMenuItem;
  variant: PublicVariant | null;
  addOns: PublicAddOn[];
  quantity: number;
  /** basePrice + variant delta + add-ons, via resolveUnitPrice(). */
  unitPrice: number;
};
