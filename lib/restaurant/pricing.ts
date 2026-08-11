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
  const taxAmount = Math.round((subtotal * rules.taxPercent) / 100);
  const deliveryFee = orderType === "DELIVERY" ? rules.deliveryFee : 0;

  return {
    subtotal,
    taxAmount,
    deliveryFee,
    total: subtotal + taxAmount + deliveryFee,
  };
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
