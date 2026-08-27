"use client";

import { cn } from "@/lib/utils";

/**
 * The shell every drawer and modal on the ordering surface shares.
 *
 * Six panels — cart, checkout, dish options, sign-in, track order, history —
 * each carried a byte-identical copy of the scrim, the positioning and the
 * panel chrome, differing only in aria-label and max-width. Six copies meant
 * six places to fix when the panel failed to separate from the page behind it,
 * which is how it stayed unfixed.
 *
 * Two jobs:
 *
 * 1. Elevation, shared. The panel is painted --resto-overlay, a level above the
 *    --resto-surface it used to use. That distinction matters most in dark
 *    mode: a sheet at --resto-surface is three points of lightness clear of the
 *    page and leans on a black drop shadow to do the rest, which on a near-black
 *    page separates nothing at all. See the note by the dark palette.
 *
 * 2. Identity, per surface. Tone decides where the panel sits, how wide it goes
 *    and what colour rides along its top edge, so the guest can tell which panel
 *    opened before reading a word of it. The accent is drawn from the tenant's
 *    own brand and the locked system gold — never an invented hue, which would
 *    be a fourth palette no restaurant controls.
 */

export type OverlayTone = "cart" | "checkout" | "dish" | "identity" | "lookup" | "history" | "rewards";

const TONE: Record<
  OverlayTone,
  { width: string; placement: string; offset?: string; accent: string | null; accentHeight: string }
> = {
  /* The ordering flow carries the brand. Cart is the only one that docks to the
     side: it is the panel a guest opens and closes repeatedly while still
     shopping, so it stays out of the middle of the menu it is a view onto. */
  cart: {
    width: "sm:max-w-md",
    placement: "sm:items-end sm:justify-center",
    offset: "sm:mr-4",
    accent: "var(--resto-brand-500)",
    accentHeight: "h-[3px]",
  },
  /* Centred, wider, and the heaviest edge on the surface. Checkout is the one
     screen here a guest commits money on, and it should feel like it took over
     the page rather than like another panel they can swipe past. */
  checkout: {
    width: "sm:max-w-lg",
    placement: "sm:items-center sm:justify-center",
    accent: "var(--resto-brand-600)",
    accentHeight: "h-1",
  },
  /* Gold, matching the rating mark: this sheet is about one dish, and gold is
     already the system's "this is about the food" accent. */
  dish: {
    width: "sm:max-w-lg",
    placement: "sm:items-center sm:justify-center",
    accent: "var(--resto-gold)",
    accentHeight: "h-[3px]",
  },
  /* Deliberately bare. The sign-in prompt is the one panel a guest is made to
     deal with before they can order, and dressing a gate in brand colour reads
     as the restaurant asking for something rather than as a step to clear. */
  identity: {
    width: "sm:max-w-sm",
    placement: "sm:items-center sm:justify-center",
    accent: null,
    accentHeight: "h-0",
  },
  /* Muted, narrow: both are lookups, not part of ordering. They share a tone
     because they answer the same question — "where is my order" — from either
     side of being signed in, and a guest who learns one should recognise the
     other. */
  lookup: {
    width: "sm:max-w-sm",
    placement: "sm:items-center sm:justify-center",
    accent: "var(--resto-text-subtle)",
    accentHeight: "h-[2px]",
  },
  history: {
    width: "sm:max-w-sm",
    placement: "sm:items-center sm:justify-center",
    accent: "var(--resto-text-subtle)",
    accentHeight: "h-[2px]",
  },
  rewards: {
    width: "sm:max-w-md",
    placement: "sm:items-center sm:justify-center",
    accent: "var(--resto-brand-500)",
    accentHeight: "h-1",
  },
};

export function OverlayShell({
  tone,
  label,
  onClose,
  dismissible = true,
  children,
}: {
  tone: OverlayTone;
  /** Names the dialog for screen readers; the visible header is the caller's. */
  label: string;
  onClose: () => void;
  /**
   * False makes the scrim inert. Used by the arrival sign-in prompt, which the
   * rest of the flow is built on and so cannot be dismissed by tapping away.
   */
  dismissible?: boolean;
  children: React.ReactNode;
}) {
  const { width, placement, offset, accent, accentHeight } = TONE[tone];

  return (
    <div className={cn("fixed inset-0 z-50 flex flex-col justify-end", placement)}>
      {dismissible ? (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute inset-0 backdrop-blur-[2px]"
          style={{ backgroundColor: "var(--resto-scrim)" }}
        />
      ) : (
        <div
          className="absolute inset-0 backdrop-blur-[2px]"
          style={{ backgroundColor: "var(--resto-scrim)" }}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        /* Radii live in classes, not inline: this is a bottom sheet on a phone
           (top corners only — the lower ones are off-screen) but a floating
           card on a desktop, where square bottom corners looked like a
           rendering fault. An inline borderTopLeftRadius silently outranks any
           sm: variant, so the responsive half could never take effect. */
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-[var(--resto-radius-xl)] sm:rounded-[var(--resto-radius-xl)]",
          width,
          offset
        )}
        style={{
          backgroundColor: "var(--resto-overlay)",
          border: "1px solid var(--resto-overlay-border)",
          boxShadow: "var(--resto-shadow-overlay)",
        }}
      >
        {/* First child rather than an absolute strip: the panel clips to its
            own radius, so a flowed bar picks up the rounded top corners for
            free and can never overlap the header's close button. */}
        {accent && (
          <span
            className={cn("shrink-0", accentHeight)}
            style={{ backgroundColor: accent }}
            aria-hidden
          />
        )}
        {children}
      </div>
    </div>
  );
}
