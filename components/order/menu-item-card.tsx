"use client";

import { Minus, Plus, Star } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ITEM_BADGE_LABEL, formatRating } from "@/lib/restaurant/menu-display";
import { DishImage } from "@/components/order/dish-image";
import { isCustomisable } from "@/components/order/use-cart";
import type { PublicMenuItem } from "@/components/order/types";

/**
 * One dish in the grid.
 *
 * Sold-out dishes are dimmed and labelled rather than removed: a returning
 * guest who cannot find yesterday's dish assumes the menu is broken, whereas
 * "Sold out for today" answers the question.
 *
 * The Add control straddles the bottom edge of the photo rather than sitting
 * in the text column. It reads as attached to the dish, and on a phone it puts
 * the tap target under the thumb rather than across the card.
 */
export function MenuItemCard({
  item,
  quantity,
  restaurantLogoUrl,
  orderingDisabled = false,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  item: PublicMenuItem;
  quantity: number;
  /** Stands in for a dish the owner never photographed — see DishImage. */
  restaurantLogoUrl: string | null;
  /** Set while the restaurant is closed — the dish is fine, the kitchen isn't. */
  orderingDisabled?: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const rating = formatRating(item.ratingValue);
  const customisable = isCustomisable(item);
  const unavailable = !item.isAvailable;

  return (
    <li
      className="relative flex items-center gap-3 border-b p-3 transition-colors bg-white hover:bg-gray-50"
      style={{
        borderColor: "var(--resto-divider)",
        opacity: unavailable ? 0.55 : 1,
      }}
    >
      <div className="flex-1 min-w-0 py-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <VegPill isVeg={item.isVeg} />
          {item.badge && (
            <span
              className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: "var(--resto-brand-tint)",
                color: "var(--resto-brand-text)",
                borderRadius: "var(--resto-radius-full)",
              }}
            >
              {ITEM_BADGE_LABEL[item.badge]}
            </span>
          )}
        </div>

        <h3
          className="text-sm font-semibold leading-snug truncate"
          style={{ color: "var(--resto-text)" }}
        >
          {item.name}
        </h3>

        {item.description && (
          <p
            className="mt-0.5 line-clamp-1 text-[13px] leading-relaxed"
            style={{ color: "var(--resto-text-muted)" }}
          >
            {item.description}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-3">
          <span
            className="resto-numeric text-sm font-bold"
            style={{ color: "var(--resto-text)" }}
          >
            {formatCurrency(item.price)}
          </span>
          {rating && (
            <span
              className="resto-numeric flex items-center gap-0.5 text-xs font-medium"
              style={{ color: "var(--resto-text-muted)" }}
            >
              <Star
                className="size-3"
                style={{ fill: "var(--resto-gold)", color: "var(--resto-gold)" }}
                aria-hidden
              />
              {rating}
            </span>
          )}
        </div>

        {unavailable ? (
          <p className="mt-1 text-xs" style={{ color: "var(--resto-text-muted)" }}>
            Sold out
          </p>
        ) : (
          customisable && (
            <span
              className="mt-1.5 inline-block px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: "var(--resto-surface-alt)",
                color: "var(--resto-text-muted)",
                borderRadius: "var(--resto-radius-sm)",
              }}
            >
              customisable
            </span>
          )
        )}
      </div>

      <div className="flex flex-col items-end shrink-0 gap-2">
        {item.imageUrl && (
          <DishImage
            url={item.imageUrl}
            alt={item.name}
            logoUrl={restaurantLogoUrl}
            width={160}
            className="w-20 h-20 rounded-md object-cover"
          />
        )}
        
        <div>
          {orderingDisabled ? null : unavailable ? (
            <span
              className="whitespace-nowrap border px-3 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: "var(--resto-surface-alt)",
                borderColor: "var(--resto-border)",
                color: "var(--resto-text-muted)",
                borderRadius: "var(--resto-radius-full)",
              }}
            >
              Unavailable
            </span>
          ) : quantity === 0 ? (
            <button
              type="button"
              onClick={onAdd}
              className="w-20 py-1.5 text-[13px] font-semibold transition-colors"
              style={{
                backgroundColor: "var(--resto-add-bg)",
                color: "var(--resto-add-text)",
                borderRadius: "var(--resto-radius-full)",
                boxShadow: "var(--resto-shadow-card)",
              }}
            >
              Add
            </button>
          ) : (
            <div
              className="flex w-20 items-center justify-between"
              style={{
                backgroundColor: "var(--resto-add-bg)",
                color: "var(--resto-add-text)",
                borderRadius: "var(--resto-radius-full)",
                boxShadow: "var(--resto-shadow-card)",
              }}
            >
              <button
                type="button"
                onClick={onDecrement}
                aria-label={`Remove one ${item.name}`}
                className="flex size-7 items-center justify-center rounded-full"
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <span className="resto-numeric text-[13px] font-bold">{quantity}</span>
              <button
                type="button"
                onClick={onIncrement}
                aria-label={
                  customisable ? `Add another ${item.name}` : `Add one ${item.name}`
                }
                className="flex size-7 items-center justify-center rounded-full"
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The green/red mark every Indian menu uses, wrapped in a tinted pill.
 *
 * Semantic, never brand-tinted — a guest who learns the square at one
 * restaurant must not have to relearn it at the next. The square itself is
 * kept inside the pill rather than replaced by a dot: it is the FSSAI mark
 * diners actually scan for.
 */
function VegPill({ isVeg }: { isVeg: boolean }) {
  const colour = isVeg ? "var(--resto-veg)" : "var(--resto-nonveg)";
  const tint = isVeg ? "var(--resto-veg-soft)" : "var(--resto-nonveg-soft)";

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: tint, color: colour, borderRadius: "var(--resto-radius-full)" }}
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span
        className="flex size-3 shrink-0 items-center justify-center rounded-[3px] border"
        style={{ borderColor: colour }}
        aria-hidden
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: colour }} />
      </span>
      {isVeg ? "Veg" : "Non-veg"}
    </span>
  );
}
