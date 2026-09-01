"use client";

import { Flame, Minus, Plus, RotateCcw } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { formatServeTime } from "@/lib/restaurant/menu-display";
import { DishImage } from "@/components/order/dish-image";
import type { PublicMenuItem } from "@/components/order/types";

/**
 * A shortcut past the menu: either what everyone is ordering right now, or
 * what this particular guest orders every time.
 *
 * A horizontal strip of compact tiles rather than the full MenuItemCard grid.
 * The card is built for deciding between dishes — description, rating, veg
 * mark, quantity stepper — and eight of them stacked above the menu would bury
 * the menu. These tiles are narrower and carry a photo, a name and a price
 * instead of the card's full detail, but the Add control at the bottom is the
 * same +/- stepper the card has once a plain (no variant/add-on) line for the
 * dish is in the cart — a guest reordering from here shouldn't lose the
 * ability to bump the quantity that the main grid gives them. Tapping the
 * tile itself still opens the options sheet where the dish needs one, exactly
 * as tapping Add on a card does.
 *
 * Two actions per tile, and they are different. Tapping the tile adds the dish
 * and leaves the guest where they were, to carry on browsing. "Buy now" adds it
 * and opens checkout, for the guest who scanned the QR code already knowing
 * what they wanted. It adds rather than replaces: a restaurant order is one
 * order per table, so anything already in the cart goes with it — silently
 * dropping it would be the worst possible reading of "buy now".
 *
 * Deliberately unlabelled as to *why* each dish is here. "Ordered 14 times in
 * the last hour" invites arithmetic about how busy the kitchen is; "You've
 * ordered this 6 times" reads as being watched. The heading says the useful
 * part and stops.
 */
export type StripVariant = "recommended" | "favourites";

const VARIANT: Record<StripVariant, { title: string; Icon: typeof Flame }> = {
  // Titled "Recommended" rather than "Trending now" now that it renders
  // alongside the guest's own history instead of standing in for it. Both
  // headings then describe what the row *is* to the guest; "trending" described
  // how it was computed, which is our business and not theirs.
  recommended: { title: "Recommended", Icon: Flame },
  // "Order it again" rather than "Your favourites": it names the action the
  // guest is about to take, and it doesn't claim to know what they like.
  favourites: { title: "Order it again", Icon: RotateCcw },
};

export function RecommendedStrip({
  items,
  variant,
  restaurantLogoUrl,
  orderingDisabled,
  quantityFor,
  onSelect,
  onIncrement,
  onDecrement,
}: {
  items: PublicMenuItem[];
  variant: StripVariant;
  /** Stands in for a dish the owner never photographed — see DishImage. */
  restaurantLogoUrl: string | null;
  orderingDisabled: boolean;
  /** The dish's plain (no variant/add-on) line quantity — the same value
   * MenuItemCard reads from cart.quantityByItem — so a tile shows the
   * stepper instead of "Add" exactly when the grid's own card would. */
  quantityFor: (item: PublicMenuItem) => number;
  onSelect: (item: PublicMenuItem) => void;
  onIncrement: (item: PublicMenuItem) => void;
  onDecrement: (item: PublicMenuItem) => void;
}) {
  if (items.length === 0) return null;

  const { title, Icon } = VARIANT[variant];

  return (
    <section className="mx-auto mt-6 w-full max-w-[var(--resto-measure)]">
      <h2
        className="resto-display flex items-center gap-1.5 px-4 text-base font-semibold"
        style={{ color: "var(--resto-text)" }}
      >
        <Icon className="size-4" style={{ color: "var(--resto-brand-text)" }} aria-hidden />
        {title}
      </h2>

      <ul className="resto-no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => {
          const serveTime = formatServeTime(item.prepMinutes);
          const quantity = quantityFor(item);

          return (
            /* h-full on the tile, not on the <li>: the list is a flex row, so
               every <li> already stretches to the tallest tile, but the tile
               inside it kept its own content height and the strip ended in a
               ragged row of bottom edges. */
            <li key={item.id} className="shrink-0">
              <div
                className="flex h-full w-[132px] flex-col gap-2 border p-2"
                style={{
                  backgroundColor: "var(--resto-card)",
                  borderColor: "var(--resto-border)",
                  borderRadius: "var(--resto-radius-lg)",
                  boxShadow: "var(--resto-shadow-card)",
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  disabled={orderingDisabled}
                  className="flex flex-col gap-2 text-left transition-opacity disabled:opacity-60"
                >
                  {/* alt="" — the dish name is the next line of the same
                      button, so naming the image too would read it twice. */}
                  <DishImage
                    url={item.imageUrl}
                    alt=""
                    logoUrl={restaurantLogoUrl}
                    width={320}
                    className="w-full"
                  />

                  {/* Two lines' worth of box whether the name fills it or not.
                      Without it a one-word dish sits its price row 18px higher
                      than its neighbour's, and prices are the one thing a guest
                      reads across the strip rather than down a tile. */}
                  <span
                    className="line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-snug"
                    style={{ color: "var(--resto-text)" }}
                  >
                    {item.name}
                  </span>

                  <span className="flex items-baseline justify-between gap-1">
                    <span
                      className="resto-numeric text-[13px] font-semibold"
                      style={{ color: "var(--resto-text)" }}
                    >
                      {formatCurrency(item.price)}
                    </span>
                    {serveTime && (
                      <span
                        className="resto-numeric text-[11px]"
                        style={{ color: "var(--resto-text-muted)" }}
                      >
                        {serveTime}
                      </span>
                    )}
                  </span>
                </button>

                {/* mt-auto so it sits on the tile's bottom edge even if a name
                    somehow renders shorter than the box above allows for. */}
                {orderingDisabled ? null : quantity === 0 ? (
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    aria-label={`Add ${item.name}`}
                    className="mt-auto w-full py-1.5 text-[12px] font-semibold transition-opacity"
                    style={{
                      backgroundColor: "var(--resto-add-bg)",
                      color: "var(--resto-add-text)",
                      borderRadius: "var(--resto-radius-full)",
                    }}
                  >
                    Add
                  </button>
                ) : (
                  <div
                    className="mt-auto flex w-full items-center justify-between"
                    style={{
                      backgroundColor: "var(--resto-add-bg)",
                      color: "var(--resto-add-text)",
                      borderRadius: "var(--resto-radius-full)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onDecrement(item)}
                      aria-label={`Remove one ${item.name}`}
                      className="flex size-7 items-center justify-center rounded-full"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="resto-numeric text-[12px] font-bold">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item)}
                      aria-label={`Add another ${item.name}`}
                      className="flex size-7 items-center justify-center rounded-full"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
