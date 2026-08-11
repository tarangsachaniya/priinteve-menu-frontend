"use client";

import { useCallback, useMemo, useState } from "react";

import { resolveUnitPrice } from "@/lib/restaurant/pricing";
import type {
  CartLine,
  PublicAddOn,
  PublicMenuCategory,
  PublicMenuItem,
  PublicVariant,
} from "@/components/order/types";

/**
 * Cart state for the customer menu. No JSX — the menu, the cart sheet and the
 * checkout sheet all read the same lines, so the maths lives apart from any
 * one of them.
 *
 * Options changed what a cart line *is*. Before, a line was a dish and a
 * quantity; now the same dish ordered large with extra cheese and again plain
 * is two lines. The composite key below is that identity, and everything else
 * follows from it.
 */

type Selection = {
  itemId: string;
  variantId: string | null;
  addOnIds: string[];
};

type Entry = Selection & { quantity: number };

/**
 * Stable identity for a selection. Add-on ids are sorted so picking cheese
 * then olives lands on the same line as olives then cheese — otherwise a guest
 * can end up with two lines of the same thing.
 */
export function cartLineKey({ itemId, variantId, addOnIds }: Selection): string {
  return [itemId, variantId ?? "", [...addOnIds].sort().join("+")].join("|");
}

/** The variant a sheet should open with: the owner's default, else the first. */
export function defaultVariant(item: PublicMenuItem): PublicVariant | null {
  if (item.variants.length === 0) return null;
  return item.variants.find((variant) => variant.isDefault) ?? item.variants[0];
}

/** Whether the dish needs a sheet before it can be added. */
export function isCustomisable(item: PublicMenuItem): boolean {
  return item.variants.length > 0 || item.addOns.length > 0;
}

export function useCart(categories: PublicMenuCategory[]) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const itemsById = useMemo(() => {
    const map = new Map<string, PublicMenuItem>();
    for (const category of categories) {
      for (const item of category.items) map.set(item.id, item);
    }
    return map;
  }, [categories]);

  const lines: CartLine[] = useMemo(() => {
    const built: CartLine[] = [];

    for (const [key, entry] of Object.entries(entries)) {
      const item = itemsById.get(entry.itemId);
      if (!item) continue;

      // An option can disappear between page load and checkout if the owner
      // edits the menu. Resolve against what's live rather than what was
      // chosen, so the total the guest sees is one the server will agree with.
      const variant = entry.variantId
        ? (item.variants.find((v) => v.id === entry.variantId) ?? null)
        : null;
      const addOns = entry.addOnIds
        .map((id) => item.addOns.find((addOn) => addOn.id === id))
        .filter((addOn): addOn is PublicAddOn => Boolean(addOn));

      built.push({
        key,
        item,
        variant,
        addOns,
        quantity: entry.quantity,
        unitPrice: resolveUnitPrice({
          basePrice: item.price,
          variantPriceDelta: variant?.priceDelta ?? 0,
          addOnPrices: addOns.map((addOn) => addOn.price),
        }),
      });
    }

    return built;
  }, [entries, itemsById]);

  const add = useCallback((selection: Selection, quantity = 1) => {
    const key = cartLineKey(selection);
    setEntries((prev) => ({
      ...prev,
      [key]: {
        ...selection,
        addOnIds: [...selection.addOnIds].sort(),
        quantity: (prev[key]?.quantity ?? 0) + quantity,
      },
    }));
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setEntries((prev) => {
      if (!prev[key]) return prev;
      if (quantity <= 0) {
        const rest = { ...prev };
        delete rest[key];
        return rest;
      }
      return { ...prev, [key]: { ...prev[key], quantity } };
    });
  }, []);

  const increment = useCallback(
    (key: string) => setEntries((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], quantity: prev[key].quantity + 1 } } : prev)),
    []
  );

  const decrement = useCallback(
    (key: string) =>
      setEntries((prev) => {
        const entry = prev[key];
        if (!entry) return prev;
        if (entry.quantity <= 1) {
          const rest = { ...prev };
          delete rest[key];
          return rest;
        }
        return { ...prev, [key]: { ...entry, quantity: entry.quantity - 1 } };
      }),
    []
  );

  const clear = useCallback(() => setEntries({}), []);

  /**
   * Total quantity of a dish across every option combination — what the card
   * in the grid shows, since one dish may sit in the cart several ways.
   */
  const quantityByItem = useMemo(() => {
    const totals = new Map<string, number>();
    for (const line of lines) {
      totals.set(line.item.id, (totals.get(line.item.id) ?? 0) + line.quantity);
    }
    return totals;
  }, [lines]);

  /** The single line for a plain dish, so +/- on the card can drive it. */
  const plainLineKey = useCallback(
    (item: PublicMenuItem) => cartLineKey({ itemId: item.id, variantId: null, addOnIds: [] }),
    []
  );

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return {
    lines,
    itemCount,
    subtotal,
    quantityByItem,
    plainLineKey,
    add,
    setQuantity,
    increment,
    decrement,
    clear,
  };
}
