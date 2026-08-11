"use client";

import { Clock, ImageOff, Minus, Plus, Star } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { ITEM_BADGE_LABEL, formatRating, formatServeTime } from "@/lib/restaurant/menu-display";
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
  orderingDisabled = false,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  item: PublicMenuItem;
  quantity: number;
  /** Set while the restaurant is closed — the dish is fine, the kitchen isn't. */
  orderingDisabled?: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const rating = formatRating(item.ratingValue);
  const serveTime = formatServeTime(item.prepMinutes);
  const customisable = isCustomisable(item);
  const unavailable = !item.isAvailable;

  return (
    <li
      /* items-start, not the default stretch: the Add control is positioned
         against the bottom of the image column, so a stretched column would
         push it down by however tall the text happens to be. That is what made
         the gap under the photo differ card to card — a dish with a badge and a
         two-line description sat visibly lower than a bare one. */
      className="relative flex items-start gap-4 border p-3 transition-colors"
      style={{
        backgroundColor: "var(--resto-card)",
        borderColor: "var(--resto-border)",
        borderRadius: "var(--resto-radius-lg)",
        boxShadow: "var(--resto-shadow-card)",
        opacity: unavailable ? 0.55 : 1,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
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
          className="resto-display mt-1.5 text-sm font-semibold leading-snug"
          style={{ color: "var(--resto-text)" }}
        >
          {item.name}
        </h3>

        {item.description && (
          <p
            className="mt-1 line-clamp-2 text-sm leading-relaxed"
            style={{ color: "var(--resto-text-muted)" }}
          >
            {item.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <span
            className="resto-numeric text-sm font-semibold"
            style={{ color: "var(--resto-text)" }}
          >
            {formatCurrency(item.price)}
          </span>
          {rating && (
            <span
              className="resto-numeric flex items-center gap-1 text-xs"
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
          {/* Muted, beside the rating rather than under the name: it's a
              qualifier on the dish, not a headline. A guest scanning for
              something quick finds it; everyone else reads past it. */}
          {serveTime && (
            <span
              className="resto-numeric flex items-center gap-1 text-xs"
              style={{ color: "var(--resto-text-muted)" }}
            >
              <Clock className="size-3" aria-hidden />
              <span className="sr-only">Takes about </span>
              {serveTime}
            </span>
          )}
        </div>

        {unavailable ? (
          <p className="mt-1.5 text-xs" style={{ color: "var(--resto-text-muted)" }}>
            Sold out for today
          </p>
        ) : (
          customisable && (
            <span
              className="mt-2 w-fit px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: "var(--resto-surface-alt)",
                color: "var(--resto-text-muted)",
                borderRadius: "var(--resto-radius-full)",
              }}
            >
              customisable
            </span>
          )
        )}
      </div>

      <div className="relative shrink-0">
        <DishImage url={item.imageUrl} alt={item.name} />

        {/* While the restaurant is closed there is no control at all, rather
            than a disabled one: a greyed-out Add invites tapping, and the
            banner above the menu has already given the reason. */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
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
              className="w-[86px] py-1.5 text-[13px] font-semibold transition-colors"
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
              className="flex w-[86px] items-center justify-between"
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
                className="flex size-8 items-center justify-center rounded-full"
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
                className="flex size-8 items-center justify-center rounded-full"
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
 * Fixed ratio and centre-crop, always. Dish photography varies wildly between
 * tenants and an un-cropped upload is the fastest way for the platform to look
 * cheap — so a missing image gets a branded placeholder, never a broken frame.
 */
function DishImage({ url, alt }: { url: string | null; alt: string }) {
  const style = {
    aspectRatio: "var(--resto-dish-ratio)",
    borderRadius: "var(--resto-radius-md)",
  } as React.CSSProperties;

  if (!url) {
    return (
      <div
        className="flex w-[92px] items-center justify-center sm:w-28"
        style={{ ...style, background: "var(--resto-placeholder)" }}
        aria-hidden
      >
        <ImageOff className="size-5" style={{ color: "var(--resto-text-subtle)" }} />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={url} alt={alt} loading="lazy" className="w-[92px] object-cover sm:w-28" style={style} />
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
