"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScratchCardFullscreen } from "@/components/order/scratch-card-fullscreen";
import { revealScratchCard, type ScratchCardEntry } from "@/lib/order/scratch-reveal";

const DISMISS_KEY_PREFIX = "pv:scratch-prompt-dismissed:";

/**
 * Shown on the paid/receipt screen when this specific order issued a scratch
 * card that hasn't been revealed yet. Visibility is driven purely by the
 * card's server-side status (fetched fresh on mount, filtered to this
 * order), so refresh/app-restart/duplicate-pay-request all behave correctly
 * by construction — an already-revealed card just won't come back ISSUED.
 */
export function BillPaidScratchPrompt({
  restaurantSlug,
  orderId,
}: {
  restaurantSlug: string;
  orderId: string;
}) {
  const [card, setCard] = useState<ScratchCardEntry | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [revealError, setRevealError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    try {
      if (sessionStorage.getItem(`${DISMISS_KEY_PREFIX}${orderId}`)) setDismissed(true);
    } catch {
      // Private-browsing contexts can throw here — never block the prompt for it.
    }

    (async () => {
      try {
        const res = await fetch(`/api/order/scratch/cards?restaurantSlug=${restaurantSlug}&orderId=${orderId}`);
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(data?.cards)) {
          const issued = (data.cards as ScratchCardEntry[]).find((c) => c.status === "ISSUED");
          if (issued) setCard(issued);
        }
      } catch {
        // A scratch card is a bonus on top of the paid receipt — a failed
        // fetch here must never block or clutter this page.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, orderId]);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${orderId}`, "1");
    } catch {
      // Best-effort only.
    }
  }

  async function reveal() {
    if (!card) return;
    setRevealError(false);
    try {
      const { card: updated } = await revealScratchCard(card.id, restaurantSlug);
      setCard(updated);
    } catch {
      setRevealError(true);
    }
  }

  if (!card || dismissed) return null;

  return (
    <>
      <section
        className="flex flex-col items-center gap-3 border p-5 text-center"
        style={{
          backgroundColor: "var(--resto-surface)",
          borderColor: "var(--resto-border)",
          borderRadius: "var(--resto-radius-lg)",
        }}
      >
        <Sparkles className="size-6" style={{ color: "var(--resto-brand-text)" }} aria-hidden />
        <div>
          <p className="text-base font-semibold" style={{ color: "var(--resto-text)" }}>
            🎉 You Got a Scratch Card!
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--resto-text-muted)" }}>
            Scratch your card and reveal your reward.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
            Later
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            Open Scratch Card
          </Button>
        </div>
      </section>

      {open && (
        <ScratchCardFullscreen
          card={card}
          onReveal={reveal}
          onClose={() => setOpen(false)}
          revealFailed={revealError}
          onRetryReveal={reveal}
        />
      )}
    </>
  );
}
