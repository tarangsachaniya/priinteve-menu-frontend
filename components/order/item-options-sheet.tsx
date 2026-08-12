"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { resolveUnitPrice } from "@/lib/restaurant/pricing";
import { defaultVariant } from "@/components/order/use-cart";
import { OverlayShell } from "@/components/order/overlay-shell";
import type { PublicMenuItem, PublicVariant } from "@/components/order/types";

/**
 * Size and add-on picker for a customisable dish.
 *
 * This exists because the schema, the validation and the order API have all
 * supported variants and add-ons from the start while the customer UI had no
 * way to choose them — every order silently went out as the plain dish. The
 * ids chosen here are what finally reach placeOrderSchema.
 *
 * Prices shown are indicative only. The server re-resolves every one of them
 * from the database when the order is placed, so a stale page cannot buy a
 * dish at yesterday's price.
 */
export function ItemOptionsSheet({
  item,
  onClose,
  onConfirm,
}: {
  item: PublicMenuItem;
  onClose: () => void;
  onConfirm: (selection: {
    itemId: string;
    variantId: string | null;
    addOnIds: string[];
    quantity: number;
  }) => void;
}) {
  const [variant, setVariant] = useState<PublicVariant | null>(() => defaultVariant(item));
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const addOnPrices = item.addOns
    .filter((addOn) => addOnIds.includes(addOn.id))
    .map((addOn) => addOn.price);

  const unitPrice = resolveUnitPrice({
    basePrice: item.price,
    variantPriceDelta: variant?.priceDelta ?? 0,
    addOnPrices,
  });

  function toggleAddOn(id: string) {
    setAddOnIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  return (
    <OverlayShell tone="dish" label={item.name} onClose={onClose}>
        <header
          className="flex items-start gap-3 border-b px-5 py-4"
          style={{ borderColor: "var(--resto-border)" }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="resto-display text-xl font-semibold" style={{ color: "var(--resto-text)" }}>
              {item.name}
            </h2>
            {item.description && (
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--resto-text-muted)" }}>
                {item.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--resto-text-muted)" }}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {item.variants.length > 0 && (
            <section
              /* Banded off the sheet body, which is --resto-overlay. Marking
                 the required group is the whole point of this block, so it has
                 to sit a level off the panel — painting it the panel's own
                 colour would delete it. */
              className="space-y-3 px-5 py-4"
              style={{ backgroundColor: "var(--resto-overlay-alt)" }}
            >
              <GroupHeading title="Choose size" requirement="Required" />
              <div className="space-y-2">
                {item.variants.map((option) => (
                  <OptionRow
                    key={option.id}
                    kind="radio"
                    checked={variant?.id === option.id}
                    onChange={() => setVariant(option)}
                    label={option.name}
                    price={option.priceDelta}
                  />
                ))}
              </div>
            </section>
          )}

          {item.addOns.length > 0 && (
            <section className="space-y-3 px-5 py-4">
              <GroupHeading title="Extra toppings" requirement="Optional" />
              <div className="space-y-2">
                {item.addOns.map((addOn) => (
                  <OptionRow
                    key={addOn.id}
                    kind="checkbox"
                    checked={addOnIds.includes(addOn.id)}
                    onChange={() => toggleAddOn(addOn.id)}
                    label={addOn.name}
                    price={addOn.price}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <footer
          className="flex items-center gap-3 border-t px-5 py-4"
          style={{
            borderColor: "var(--resto-border)",
            backgroundColor: "var(--resto-overlay-alt)",
          }}
        >
          <div
            className="flex items-center gap-1 border"
            style={{
              borderColor: "var(--resto-border)",
              borderRadius: "var(--resto-radius-full)",
            }}
          >
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Reduce quantity"
              className="flex size-9 items-center justify-center rounded-full disabled:opacity-40"
              style={{ color: "var(--resto-text)" }}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span
              className="resto-numeric w-6 text-center text-sm font-semibold"
              style={{ color: "var(--resto-text)" }}
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              aria-label="Increase quantity"
              className="flex size-9 items-center justify-center rounded-full"
              style={{ color: "var(--resto-text)" }}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onConfirm({ itemId: item.id, variantId: variant?.id ?? null, addOnIds, quantity })
            }
            className="resto-numeric flex-1 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "var(--resto-brand-500)",
              color: "var(--on-brand)",
              borderRadius: "var(--resto-radius-full)",
            }}
          >
            Add item · {formatCurrency(unitPrice * quantity)}
          </button>
        </footer>
    </OverlayShell>
  );
}

function GroupHeading({ title, requirement }: { title: string; requirement: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3
        className="text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--resto-text-muted)" }}
      >
        {title}
      </h3>
      <span className="text-[11px]" style={{ color: "var(--resto-text-subtle)" }}>
        {requirement}
      </span>
    </div>
  );
}

/**
 * `price` is a delta for variants and an absolute for add-ons, which is why it
 * is rendered signed: "+₹40" and "−₹20" both have to be unambiguous next to a
 * base price the guest already saw on the card.
 */
function OptionRow({
  kind,
  checked,
  onChange,
  label,
  price,
}: {
  kind: "radio" | "checkbox";
  checked: boolean;
  onChange: () => void;
  label: string;
  price: number;
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-3 border px-3 py-2.5 transition-colors"
      style={{
        backgroundColor: checked ? "var(--resto-brand-tint)" : "var(--resto-card)",
        borderColor: checked ? "var(--resto-brand-tint-border)" : "var(--resto-border)",
        borderRadius: "var(--resto-radius-md)",
      }}
    >
      <input
        type={kind}
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-[var(--resto-brand-500)]"
      />
      <span className="min-w-0 flex-1 text-sm" style={{ color: "var(--resto-text)" }}>
        {label}
      </span>
      {price !== 0 && (
        <span
          className="resto-numeric text-sm font-medium"
          style={{ color: "var(--resto-text-muted)" }}
        >
          {price > 0 ? "+" : "−"}
          {formatCurrency(Math.abs(price))}
        </span>
      )}
    </label>
  );
}
