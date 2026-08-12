"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

import { sizedImageUrl } from "@/lib/restaurant/image";
import { cn } from "@/lib/utils";
import type { PublicMenuCategory } from "@/components/order/types";

/**
 * A swipeable way into the menu, one tile per category.
 *
 * The toolbar already has category chips, so this is not a second filter — it
 * is a different job. Chips are a control strip: small, text-only, and they
 * assume the guest already knows what "Kolhapuri" is. This is for the guest who
 * has just scanned a QR code and wants to see what kind of place this is, so
 * the tiles are photographic and sized to be looked at rather than aimed at.
 * Tapping one sets exactly the same filter a chip does — two doors, one room.
 *
 * No autoplay. A carousel that advances on its own on a page the guest is
 * already scrolling steals the thing they were reading, and an accessible
 * autoplay needs pause controls that would cost more room than the feature is
 * worth here. Swipe on a phone, arrows on a desktop, nothing moves unasked.
 */
export function CategoryCarousel({
  categories,
  activeCategoryId,
  onSelect,
}: {
  categories: PublicMenuCategory[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Arrows are hidden at the ends rather than disabled: a control that cannot
  // do anything is noise, and there are only ever two of them.
  const syncArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const max = track.scrollWidth - track.clientWidth;
    setAtStart(track.scrollLeft <= 1);
    // A pixel of slack — scrollLeft is fractional under browser zoom and on
    // high-DPI displays, so an exact comparison leaves the arrow stuck on.
    setAtEnd(track.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    syncArrows();
    const track = trackRef.current;
    if (!track) return;

    // Also on resize: rotating a phone changes how many tiles fit, which can
    // put a track that was scrollable entirely on screen.
    const observer = new ResizeObserver(syncArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [syncArrows, categories.length]);

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    // Just under a full width so the tile at the edge stays partly visible and
    // the guest keeps their place instead of landing on an unfamiliar row.
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  if (categories.length < 2) return null;

  return (
    <section className="mx-auto mt-6 w-full max-w-[var(--resto-measure)]">
      <div className="flex items-center justify-between gap-2 px-4">
        <h2
          className="resto-display text-base font-semibold"
          style={{ color: "var(--resto-text)" }}
        >
          Browse by category
        </h2>

        <div className="hidden items-center gap-1.5 md:flex">
          <ArrowButton
            direction="prev"
            hidden={atStart}
            onClick={() => scrollByPage(-1)}
          />
          <ArrowButton direction="next" hidden={atEnd} onClick={() => scrollByPage(1)} />
        </div>
      </div>

      <ul
        ref={trackRef}
        onScroll={syncArrows}
        className="resto-no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1"
      >
        {categories.map((category) => {
          const active = category.id === activeCategoryId;
          // Categories carry no image of their own, so the first dish that has
          // one stands in for it. It is the same photo the guest will see when
          // they land, which makes the tile a preview rather than decoration.
          const cover = category.items.find((item) => item.imageUrl)?.imageUrl ?? null;
          const count = category.items.filter((item) => item.isAvailable).length;

          return (
            <li key={category.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onSelect(category.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-[42vw] max-w-[200px] flex-col gap-2 border p-2 text-left transition-colors sm:w-[168px]"
                )}
                style={{
                  backgroundColor: "var(--resto-card)",
                  borderColor: active ? "var(--resto-brand-500)" : "var(--resto-border)",
                  borderRadius: "var(--resto-radius-lg)",
                  boxShadow: "var(--resto-shadow-card)",
                }}
              >
                {cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={sizedImageUrl(cover, { width: 320 })}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full object-cover"
                    style={{
                      aspectRatio: "var(--resto-dish-ratio)",
                      borderRadius: "var(--resto-radius-md)",
                    }}
                  />
                ) : (
                  <span
                    className="flex w-full items-center justify-center"
                    style={{
                      aspectRatio: "var(--resto-dish-ratio)",
                      background: "var(--resto-placeholder)",
                      borderRadius: "var(--resto-radius-md)",
                    }}
                    aria-hidden
                  >
                    <ImageOff className="size-4" style={{ color: "var(--resto-text-subtle)" }} />
                  </span>
                )}

                <span
                  className="line-clamp-1 text-[13px] font-semibold"
                  style={{ color: active ? "var(--resto-brand-text)" : "var(--resto-text)" }}
                >
                  {category.name}
                </span>
                <span
                  className="resto-numeric text-[11px]"
                  style={{ color: "var(--resto-text-muted)" }}
                >
                  {count} {count === 1 ? "dish" : "dishes"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ArrowButton({
  direction,
  hidden,
  onClick,
}: {
  direction: "prev" | "next";
  hidden: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous categories" : "More categories"}
      // Kept in the layout when unusable so the heading row doesn't reflow as
      // the guest scrolls to either end.
      className={cn(
        "flex size-8 items-center justify-center border transition-opacity",
        hidden && "pointer-events-none opacity-0"
      )}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : undefined}
      style={{
        backgroundColor: "var(--resto-card)",
        borderColor: "var(--resto-border)",
        borderRadius: "var(--resto-radius-full)",
        color: "var(--resto-text-muted)",
      }}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
