"use client";

import { ImageOff } from "lucide-react";

import { sizedImageUrl } from "@/lib/restaurant/image";
import { cn } from "@/lib/utils";

/**
 * A dish photo, and what stands in its place when there isn't one.
 *
 * Fixed ratio and centre-crop, always. Dish photography varies wildly between
 * tenants and an un-cropped upload is the fastest way for the platform to look
 * cheap — so a missing image gets a branded placeholder, never a broken frame.
 *
 * "Branded" means the restaurant's own logo, not a no-image glyph. A menu where
 * half the dishes carry a crossed-out camera reads as broken; the same menu
 * carrying the restaurant's mark reads as a house style. It is drawn as a
 * watermark — contained, inset, faded — so it is never mistaken for a photo of
 * the dish, and so a tall logo and a wide one both sit correctly in a landscape
 * frame.
 *
 * The platform's own logo is deliberately not the fallback: a guest is here for
 * the restaurant, and PlatformCredit at the foot of the page is the only place
 * Priinteve gets to say its name.
 *
 * Three surfaces draw a dish photo — the card, the shortcut strips and the
 * category tiles. All three used to carry their own copy of this markup, which
 * is exactly how they came to have three subtly different placeholders.
 */
export function DishImage({
  url,
  alt,
  logoUrl,
  width,
  className,
}: {
  /** The dish photo, or null when the owner hasn't uploaded one. */
  url: string | null;
  /** Empty on tiles whose name is already read out beside the image. */
  alt: string;
  /** The restaurant's logo, used as the placeholder mark. */
  logoUrl: string | null;
  /** CSS px the image actually draws at; dpr is handled by the optimiser. */
  width: number;
  /** Width utilities only — ratio and corner come from the tokens below. */
  className?: string;
}) {
  const style = {
    aspectRatio: "var(--resto-dish-ratio)",
    borderRadius: "var(--resto-radius-md)",
  } as React.CSSProperties;

  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        // Requested at the size it actually draws rather than at the 800px the
        // upload stores. Thirty of these is the bulk of what a menu page weighs.
        src={sizedImageUrl(url, { width })}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn("object-cover", className)}
        style={style}
      />
    );
  }

  return (
    <span
      className={cn("flex items-center justify-center overflow-hidden", className)}
      style={{ ...style, background: "var(--resto-placeholder)" }}
      aria-hidden
    >
      {logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          // 192 to match RestaurantHero: the same optimised URL, so a menu with
          // twenty photo-less dishes fetches the logo once and draws it twenty
          // times rather than asking for a per-tile size.
          src={sizedImageUrl(logoUrl, { width: 192, fit: "limit" })}
          alt=""
          loading="lazy"
          decoding="async"
          // Contained and inset well inside the frame. Most tenant logos are
          // wordmarks, and one bled to the edges of a landscape box would read
          // as the dish itself rather than as the absence of a photo.
          className="max-h-[58%] max-w-[68%] object-contain opacity-70"
        />
      ) : (
        // A tenant with neither dish photos nor a logo still needs a filled
        // frame rather than a hole.
        <ImageOff className="size-5" style={{ color: "var(--resto-text-subtle)" }} />
      )}
    </span>
  );
}
