"use client";

import { Clock, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { estimateOrderMinutes, formatOrderEstimate } from "@/lib/restaurant/menu-display";
import type { CartLine } from "@/components/order/types";

/**
 * The cart, as a bottom sheet.
 *
 * Lines are keyed by their option combination rather than by dish, so the same
 * pizza ordered large and again regular shows as two rows. Each row spells out
 * the chosen size and add-ons: a guest who cannot see what they picked will
 * either re-add it or abandon the order.
 */
export function CartSheet({
  lines,
  subtotal,
  onClose,
  onIncrement,
  onDecrement,
  onCheckout,
}: {
  lines: CartLine[];
  subtotal: number;
  onClose: () => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onCheckout: () => void;
}) {
  // The slowest dish, not the sum — a kitchen cooks in parallel. See
  // estimateOrderMinutes() for why that distinction matters here.
  const estimate = formatOrderEstimate(
    estimateOrderMinutes(lines.map((line) => ({ prepMinutes: line.item.prepMinutes })))
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-end sm:justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your order"
        /* Radii live in classes, not inline: this is a bottom sheet on a phone
           (top corners only — the lower ones are off-screen) but a floating
           card on a desktop, where square bottom corners looked like a
           rendering fault. An inline borderTopLeftRadius silently outranks any
           sm: variant, so the responsive half could never take effect. */
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-[var(--resto-radius-xl)] sm:mr-4 sm:max-w-md sm:rounded-[var(--resto-radius-xl)]"
        /* One step off the page, not the page itself. A panel painted
           --resto-bg is the same colour as what it sits on, so it reads as a
           continuation of the menu rather than as a layer above it. The border
           carries the rest of the separation: --resto-surface is only about a
           percent of lightness away in light mode, which the eye will not find
           on its own. */
        style={{
          backgroundColor: "var(--resto-surface)",
          border: "1px solid var(--resto-border)",
          boxShadow: "var(--resto-shadow-overlay)",
        }}
      >
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--resto-border)" }}
        >
          <h2 className="resto-display text-xl font-semibold" style={{ color: "var(--resto-text)" }}>
            Your order
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--resto-text-muted)" }}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {lines.length === 0 ? (
          <EmptyCart onClose={onClose} />
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-5 py-2">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="flex items-start gap-3 border-b py-3 last:border-b-0"
                  style={{ borderColor: "var(--resto-divider)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="resto-display text-sm font-semibold"
                      style={{ color: "var(--resto-text)" }}
                    >
                      {line.item.name}
                    </p>
                    {(line.variant || line.addOns.length > 0) && (
                      <p className="mt-0.5 text-xs" style={{ color: "var(--resto-text-muted)" }}>
                        {[line.variant?.name, ...line.addOns.map((addOn) => addOn.name)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p
                      className="resto-numeric mt-0.5 text-xs"
                      style={{ color: "var(--resto-text-subtle)" }}
                    >
                      {formatCurrency(line.unitPrice)} each
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div
                      className="flex items-center gap-1 border"
                      style={{
                        borderColor: "var(--resto-border)",
                        borderRadius: "var(--resto-radius-full)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onDecrement(line.key)}
                        aria-label={`Remove one ${line.item.name}`}
                        className="flex size-7 items-center justify-center rounded-full"
                        style={{ color: "var(--resto-text)" }}
                      >
                        {line.quantity === 1 ? (
                          <Trash2 className="size-3.5" aria-hidden />
                        ) : (
                          <Minus className="size-3.5" aria-hidden />
                        )}
                      </button>
                      <span
                        className="resto-numeric w-5 text-center text-sm font-semibold"
                        style={{ color: "var(--resto-text)" }}
                      >
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onIncrement(line.key)}
                        aria-label={`Add one ${line.item.name}`}
                        className="flex size-7 items-center justify-center rounded-full"
                        style={{ color: "var(--resto-text)" }}
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <span
                      className="resto-numeric text-sm font-semibold"
                      style={{ color: "var(--resto-text)" }}
                    >
                      {formatCurrency(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <footer
              className="space-y-3 border-t px-5 py-4"
              style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-card)" }}
            >
              {/* Above the total, because it is the other thing a guest is
                  deciding on. Omitted entirely when nothing in the cart has a
                  quoted time — an estimate built from no data is worse than
                  none. */}
              {estimate && (
                <p
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: "var(--resto-text-muted)" }}
                >
                  <Clock className="size-3.5 shrink-0" aria-hidden />
                  {estimate}
                </p>
              )}

              <div className="flex items-baseline justify-between">
                <span className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
                  Item total
                </span>
                <span
                  className="resto-numeric resto-display text-base font-semibold"
                  style={{ color: "var(--resto-text)" }}
                >
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={onCheckout}
                className="w-full py-3 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: "var(--resto-brand-500)",
                  color: "var(--on-brand)",
                  borderRadius: "var(--resto-radius-full)",
                }}
              >
                Proceed to checkout
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
      <span
        className="grid size-16 place-items-center rounded-full"
        style={{ backgroundColor: "var(--resto-brand-tint)" }}
      >
        <ShoppingBag className="size-7" style={{ color: "var(--resto-brand-text)" }} aria-hidden />
      </span>
      <div>
        <p className="resto-display text-lg font-semibold" style={{ color: "var(--resto-text)" }}>
          Your cart is empty
        </p>
        <p className="mt-1 max-w-xs text-sm" style={{ color: "var(--resto-text-muted)" }}>
          Add a dish from the menu and it will show up here.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-sm font-medium transition-colors"
        style={{
          backgroundColor: "var(--resto-brand-500)",
          color: "var(--on-brand)",
          borderRadius: "var(--resto-radius-full)",
        }}
      >
        Browse the menu
      </button>
    </div>
  );
}

/**
 * The floating summary that follows the guest down the menu.
 *
 * It is the only element carrying the brand-tinted shadow: it hovers over the
 * page with nothing behind it to ground it, and a neutral drop shadow leaves
 * it looking pasted on.
 */
export function CartBar({
  itemCount,
  subtotal,
  onOpen,
}: {
  itemCount: number;
  subtotal: number;
  onOpen: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <div className="pointer-events-auto mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors"
          style={{
            backgroundColor: "var(--resto-brand-500)",
            color: "var(--on-brand)",
            borderRadius: "var(--resto-radius-lg)",
            boxShadow: "var(--resto-shadow-float)",
          }}
        >
          <span className="flex flex-col">
            <span className="resto-numeric text-xs opacity-80">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="resto-numeric resto-display text-base font-bold">
              {formatCurrency(subtotal)}
            </span>
          </span>
          <span className="flex items-center gap-2 text-sm font-semibold">
            View cart
            <ShoppingBag className="size-4" aria-hidden />
          </span>
        </button>
      </div>
    </div>
  );
}
