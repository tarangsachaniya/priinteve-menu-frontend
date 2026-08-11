"use client";

import { useState } from "react";
import { ChevronDown, Clock, MapPin, Phone, Star, UtensilsCrossed, Wallet } from "lucide-react";

import { DAY_LABELS, formatMinutes, nowInTimezone } from "@/lib/restaurant/hours";
import {
  formatCostForTwo,
  formatPrepTime,
  formatRating,
  formatRatingCount,
} from "@/lib/restaurant/menu-display";
import { cn } from "@/lib/utils";
import { RestoModeToggle } from "@/components/order/resto-mode-toggle";
import type { PublicRestaurant, PublicTable } from "@/components/order/types";

/**
 * Everything above the menu: cover, identity and the facts a guest checks
 * before deciding to order.
 *
 * The identity block sits *below* the cover and pulls up over its lower edge,
 * rather than sitting inside the image on a dark scrim. That is worth being
 * deliberate about: text over a tenant-supplied photo has to be white, which
 * forces a scrim, which makes light mode a lie — the page would render dark at
 * the top whatever the guest chose. Moving identity onto the page background
 * means both modes are honest, the name is legible without depending on how
 * bright a restaurant's photo happens to be, and the cover only has to fade
 * into the page rather than carry contrast.
 *
 * Each block is omitted when its field is unset rather than rendered empty, so
 * a restaurant that only filled in a name still gets a page that looks
 * finished. That matters more here than anywhere else — this is the first
 * screen after a QR scan.
 */
export function RestaurantHero({
  restaurant,
  table,
}: {
  restaurant: PublicRestaurant;
  table: PublicTable | null;
}) {
  const rating = formatRating(restaurant.ratingValue);
  const ratingCount = formatRatingCount(restaurant.ratingCount);
  const prepTime = formatPrepTime(restaurant.prepTimeMinMins, restaurant.prepTimeMaxMins);
  const costForTwo = formatCostForTwo(restaurant.costForTwo);
  const eyebrow =
    restaurant.tagline ??
    (restaurant.cuisineTags.length > 0 ? restaurant.cuisineTags.join(" · ") : null);

  return (
    <header>
      <div className="relative h-52 w-full overflow-hidden md:h-72">
        {restaurant.coverImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={restaurant.coverImageUrl}
            alt=""
            className="size-full object-cover"
            aria-hidden
          />
        ) : (
          <div className="size-full" style={{ background: "var(--resto-placeholder)" }} aria-hidden />
        )}

        {/* Fades to the page colour, not to black, so the seam disappears in
            either mode. */}
        <div
          className="absolute inset-0"
          style={{ background: "var(--resto-gradient-fade)" }}
          aria-hidden
        />

        {/* The only controls still sitting on the photo, so they keep the
            translucent treatment that works over an unknown image. */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              aria-label={`Call ${restaurant.name}`}
              className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/55"
            >
              <Phone className="size-4" aria-hidden />
            </a>
          )}
          <RestoModeToggle slug={restaurant.slug} ownerMode={restaurant.themeMode} />
        </div>
      </div>

      {/* Only the logo tile is allowed onto the photo. The negative margin used
          to sit on this wrapper with the row centred, which dragged the eyebrow
          and the restaurant name up into the image too — text over a
          tenant-supplied photo, exactly what the note above rules out, and it
          rendered the name unreadable against a dark cover. Pulling the tile
          alone keeps the overlap that ties the two halves together while every
          word stays on the page background. */}
      <div className="relative z-10 mx-auto w-full max-w-[var(--resto-measure)] px-4">
        <div className="mb-4 flex items-end gap-3">
          <span
            className="-mt-14 grid size-20 shrink-0 place-items-center overflow-hidden border p-2 md:-mt-16 md:size-24"
            style={{
              backgroundColor: "var(--resto-card)",
              borderColor: "var(--resto-border)",
              borderRadius: "var(--resto-radius-lg)",
              boxShadow: "var(--resto-shadow-card)",
            }}
          >
            {restaurant.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={restaurant.logoUrl} alt="" className="size-full object-contain" />
            ) : (
              <UtensilsCrossed
                className="size-7 md:size-8"
                style={{ color: "var(--resto-brand-text)" }}
                aria-hidden
              />
            )}
          </span>

          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--resto-brand-text)" }}
              >
                {eyebrow}
              </p>
            )}
            <h1
              className={cn(
                "resto-display text-xl font-bold leading-tight md:text-3xl",
                eyebrow && "mt-1.5"
              )}
              style={{ color: "var(--resto-text)" }}
            >
              {restaurant.name}
            </h1>
            {restaurant.branch && (
              <p className="mt-0.5 text-sm" style={{ color: "var(--resto-text-muted)" }}>
                {restaurant.branch}
              </p>
            )}
          </div>
        </div>

        {restaurant.description && (
          <p
            className="mt-4 max-w-2xl text-sm leading-relaxed"
            style={{ color: "var(--resto-text-muted)" }}
          >
            {restaurant.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <OpenBadge state={restaurant.openState} />
          {rating && (
            <MetaPill>
              <Star
                className="size-3.5"
                style={{ fill: "var(--resto-gold)", color: "var(--resto-gold)" }}
                aria-hidden
              />
              <span className="resto-numeric font-semibold">{rating}</span>
              {ratingCount && (
                <span style={{ color: "var(--resto-text-subtle)" }}>({ratingCount})</span>
              )}
            </MetaPill>
          )}
          {prepTime && (
            <MetaPill>
              <Clock className="size-3.5" aria-hidden />
              <span className="resto-numeric">{prepTime}</span>
            </MetaPill>
          )}
          {costForTwo && (
            <MetaPill>
              <Wallet className="size-3.5" aria-hidden />
              <span className="resto-numeric">{costForTwo}</span>
            </MetaPill>
          )}
          {/* A guest at a table needs to know which one the order will reach
              far more than they need the street address. */}
          {table ? (
            <MetaPill emphasis>
              <UtensilsCrossed className="size-3.5" aria-hidden />
              {table.label}
            </MetaPill>
          ) : (
            restaurant.address && (
              <MetaPill>
                <MapPin className="size-3.5" aria-hidden />
                {restaurant.address}
              </MetaPill>
            )
          )}
        </div>

        <WeeklyHours hours={restaurant.hours} timezone={restaurant.timezone} />
      </div>
    </header>
  );
}

/**
 * Open / closed, in semantic colour and never brand-tinted (spec §6 and §7).
 *
 * A guest who learns that green means open at one restaurant must not have to
 * relearn it at the next, which is exactly why this one pill is exempt from
 * the tenant's palette. The dot is there so the state survives being read by
 * someone who cannot distinguish the two colours — as does the wording.
 */
function OpenBadge({ state }: { state: PublicRestaurant["openState"] }) {
  const colour = state.isOpen ? "var(--resto-success)" : "var(--resto-error)";
  const tint = state.isOpen ? "var(--resto-success-soft)" : "var(--resto-error-soft)";

  return (
    <span
      className="flex items-center gap-1.5 px-3 py-1 text-sm font-semibold"
      style={{ backgroundColor: tint, color: colour, borderRadius: "var(--resto-radius-full)" }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: colour }} aria-hidden />
      {state.isOpen ? "Open" : "Closed"}
      <span className="font-normal opacity-80">· {state.label}</span>
    </span>
  );
}

/**
 * The full week, collapsed by default.
 *
 * Today's row is marked rather than shown alone: the question a guest actually
 * has is usually "will they be open tomorrow", and the answer is only useful
 * next to the rest of the week.
 */
function WeeklyHours({
  hours,
  timezone,
}: {
  hours: PublicRestaurant["hours"];
  timezone: string;
}) {
  const [open, setOpen] = useState(false);

  // A restaurant with no rows is always open — there is nothing to show.
  if (hours.length === 0) return null;

  const today = nowInTimezone(timezone).dayOfWeek;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
        style={{ color: "var(--resto-text-muted)" }}
      >
        <Clock className="size-3.5" aria-hidden />
        Opening hours
        <ChevronDown
          className="size-3.5 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        />
      </button>

      {open && (
        <dl
          className="mt-2 max-w-xs border p-3 text-xs"
          style={{
            backgroundColor: "var(--resto-card)",
            borderColor: "var(--resto-border)",
            borderRadius: "var(--resto-radius-md)",
          }}
        >
          {[...hours]
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((day) => {
              const isToday = day.dayOfWeek === today;
              return (
                <div key={day.dayOfWeek} className="flex justify-between gap-4 py-0.5">
                  <dt
                    style={{
                      color: isToday ? "var(--resto-text)" : "var(--resto-text-muted)",
                      fontWeight: isToday ? 600 : undefined,
                    }}
                  >
                    {DAY_LABELS[day.dayOfWeek]}
                  </dt>
                  <dd
                    className="resto-numeric"
                    style={{
                      color: day.isClosed ? "var(--resto-text-subtle)" : "var(--resto-text)",
                      fontWeight: isToday ? 600 : undefined,
                    }}
                  >
                    {day.isClosed
                      ? "Closed"
                      : `${formatMinutes(day.opensAt)} – ${formatMinutes(day.closesAt)}`}
                  </dd>
                </div>
              );
            })}
        </dl>
      )}
    </div>
  );
}

/** `emphasis` marks the table pill — the one fact the guest must not misread. */
function MetaPill({
  children,
  emphasis = false,
}: {
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <span
      className="flex items-center gap-1.5 px-3 py-1 text-sm"
      style={{
        backgroundColor: emphasis ? "var(--resto-brand-tint)" : "var(--resto-surface-alt)",
        color: emphasis ? "var(--resto-brand-text)" : "var(--resto-text-muted)",
        borderRadius: "var(--resto-radius-full)",
        fontWeight: emphasis ? 600 : undefined,
      }}
    >
      {children}
    </span>
  );
}
