import type { RestoOrderType } from "@/lib/api/enums";

/**
 * The single source of truth for what an order costs.
 *
 * The cart UI calls this to show a running total and the place-order API
 * calls it again with prices read from the database. A client-sent total is
 * never trusted — same rule as the card purchase flow
 * (see app/api/purchase/initiate/route.ts).
 *
 * All amounts are whole rupees.
 */

export type PricedLine = {
  unitPrice: number;
  quantity: number;
};

export type PricingRules = {
  taxPercent: number;
  /**
   * False (the default, and every existing restaurant's behaviour): taxPercent
   * is added on top of `subtotal` — a ₹200 dish costs ₹210 at 5%.
   *
   * True: the menu price already has GST folded into it, so the guest pays
   * exactly `subtotal` and `taxAmount` is derived back OUT of it instead of
   * added — the figure printed on the invoice, not a charge on top of it.
   *
   * MUST stay identical to priinteve-api's copy of this file — the cart here
   * shows a preview total and the API computes the charged total separately,
   * and a mismatch between the two is a guest paying a different number than
   * the one they were shown.
   */
  taxInclusive: boolean;
  deliveryFee: number;
};

export type OrderTotals = {
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
};

export function computeOrderTotals({
  items,
  rules,
  orderType,
}: {
  items: PricedLine[];
  rules: PricingRules;
  orderType: RestoOrderType;
}): OrderTotals {
  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const deliveryFee = orderType === "DELIVERY" ? rules.deliveryFee : 0;

  /**
   * `taxAmount` always means the same thing — the GST figure that belongs on
   * the invoice's CGST/SGST lines (see splitTax in gst.ts). Only whether it is
   * ADDED to what the guest pays changes between the two branches.
   *
   * Inclusive: back-computed as subtotal minus its own pre-tax base, so a ₹200
   * dish at 5% reports ₹9.52 of GST already inside that ₹200 — never added to
   * `total`. Delivery is never taxed in either mode: it is a separate line
   * item on the invoice, not part of the priced menu.
   */
  const taxAmount = rules.taxInclusive
    ? subtotal - Math.round((subtotal * 100) / (100 + rules.taxPercent))
    : Math.round((subtotal * rules.taxPercent) / 100);

  const total = rules.taxInclusive ? subtotal + deliveryFee : subtotal + taxAmount + deliveryFee;

  return { subtotal, taxAmount, deliveryFee, total };
}

export function lineTotal(line: PricedLine): number {
  return line.unitPrice * line.quantity;
}

/**
 * What one unit of a dish costs once its options are applied.
 *
 * The variant adjusts the base price (so raising a dish's price moves every
 * size with it) while add-ons are absolute. The cart calls this to show a
 * running total and the place-order API calls it again with values read from
 * the database — the same never-trust-the-client rule that governs
 * computeOrderTotals above.
 */
export function resolveUnitPrice({
  basePrice,
  variantPriceDelta = 0,
  addOnPrices = [],
}: {
  basePrice: number;
  variantPriceDelta?: number;
  addOnPrices?: number[];
}): number {
  const withOptions =
    basePrice + variantPriceDelta + addOnPrices.reduce((sum, price) => sum + price, 0);
  // A generous negative variant delta must never make a dish free or owed.
  return Math.max(0, withOptions);
}
