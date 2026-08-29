import type { RestoOrderType } from "@/lib/api/enums";

/**
 * The single source of truth for what an order costs.
 *
 * The cart UI calls this to show a running total and the place-order API
 * calls it again with prices read from the database. A client-sent total is
 * never trusted — same rule as the card purchase flow
 * (see app/api/purchase/initiate/route.ts).
 *
 * Item-level amounts (unitPrice, quantity) are always whole rupees — menu
 * prices are entered that way. `taxAmount`/`total`, though, are routinely
 * fractional (5% of a whole-rupee subtotal is not itself whole — ₹150 → ₹7.50
 * tax), so they carry up to 2 decimal places. See RestoOrder's schema comment
 * (priinteve-api) for why those two columns are `Decimal(10,2)` rather than
 * `Int`.
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
   *
   * Rounded to the nearest PAISA (2 decimal places), never the nearest whole
   * rupee — `subtotal * rules.taxPercent` is an exact integer product (both
   * operands are integers), so dividing it by 100 at the end is exact for
   * every value that matters here: ₹150 × 5% → 750 / 100 = ₹7.50, not ₹8.
   *
   * The inclusive branch subtracts two PAISA-scale integers (`subtotal * 100`
   * and the rounded taxable-base paisa count) and divides by 100 only once,
   * at the very end — never `subtotal - taxableBase` as two already-rounded
   * decimals. Rupee amounts like ₹95.24 have no exact IEEE-754 double, so
   * subtracting two of them accumulates a residue (100 - 95.24 lands on
   * 4.760000000000005, not 4.76) that a strict `=== 4.76` bill-reconciliation
   * check would fail on.
   */
  const taxAmount = rules.taxInclusive
    ? (Math.round(subtotal * 100) - Math.round((subtotal * 10000) / (100 + rules.taxPercent))) / 100
    : Math.round(subtotal * rules.taxPercent) / 100;

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
