"use client";

import { useEffect, useState } from "react";
import { Gift, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { OverlayShell } from "@/components/order/overlay-shell";
import { ScratchCardFullscreen } from "@/components/order/scratch-card-fullscreen";
import { revealScratchCard, type ScratchCardEntry } from "@/lib/order/scratch-reveal";

type RewardHistory = {
  id: string;
  amount: number; // positive or negative
  description: string;
  date: string;
};

export type RewardsData = {
  loyaltyEnabled: boolean;
  scratchEnabled: boolean;
  pointsBalance: number;
  unscratchedCardsCount: number;
  totalScratchCards: number;
  scratchedCardsCount: number;
  history: RewardHistory[];
};

export function MyRewardsSheet({
  restaurantSlug,
  customer,
  onClose,
}: {
  restaurantSlug: string;
  customer: { name: string; mobile: string } | null;
  onClose: () => void;
}) {
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [cards, setCards] = useState<ScratchCardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  // The card currently open in the full-screen scratch view, if any.
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  // Id of the card whose last reveal attempt failed server-side, if any.
  const [revealError, setRevealError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;

    let cancelled = false;
    setIsLoading(true);
    setError(false);

    (async () => {
      try {
        const [meRes, cardsRes] = await Promise.all([
          fetch(`/api/order/rewards/me?restaurantSlug=${restaurantSlug}`),
          fetch(`/api/order/scratch/cards?restaurantSlug=${restaurantSlug}`),
        ]);
        if (!meRes.ok) throw new Error("Failed to load rewards");
        const data = await meRes.json();
        const cardsData = await cardsRes.json().catch(() => ({ cards: [] }));

        if (!cancelled) {
          setRewards({
            loyaltyEnabled: Boolean(data.loyaltyEnabled),
            scratchEnabled: Boolean(data.scratchEnabled),
            pointsBalance: data.pointsBalance || 0,
            unscratchedCardsCount: data.unscratchedCardsCount || 0,
            totalScratchCards: data.totalScratchCards || 0,
            scratchedCardsCount: data.scratchedCardsCount || 0,
            history: data.history || [],
          });
          setCards(cardsData.cards ?? []);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customer, restaurantSlug]);

  async function scratch(cardId: string) {
    setRevealError(null);
    const previousStatus = cards.find((c) => c.id === cardId)?.status;
    try {
      const { card, pointsBalanceAfter } = await revealScratchCard(cardId, restaurantSlug);
      setCards((prev) => prev.map((c) => (c.id === cardId ? card : c)));
      // A LOYALTY_POINTS reward is auto-credited the instant it's revealed
      // (see order/scratch.routes.ts) — reflect the new balance immediately
      // rather than leaving the tile stale until the sheet reopens.
      if (typeof pointsBalanceAfter === "number") {
        setRewards((prev) => (prev ? { ...prev, pointsBalance: pointsBalanceAfter } : prev));
      }
      // Only move the counts the first time this card actually flips off
      // ISSUED — a retried call after a lost response is idempotent
      // server-side but must not double-decrement the tile counts.
      if (previousStatus === "ISSUED" && card.status !== "ISSUED") {
        setRewards((prev) =>
          prev
            ? { ...prev, unscratchedCardsCount: Math.max(0, prev.unscratchedCardsCount - 1), scratchedCardsCount: prev.scratchedCardsCount + 1 }
            : prev,
        );
      }
    } catch {
      setRevealError(cardId);
      toast.error("Couldn't reveal your reward. Tap to try again.");
    }
  }

  const activeCards = cards.filter((c) => c.status === "ISSUED" || c.status === "AVAILABLE");

  return (
    <OverlayShell tone="rewards" label="My Rewards" onClose={onClose}>
      <header
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: "var(--resto-border)" }}
      >
        <h2 className="resto-display text-xl font-semibold flex items-center gap-2" style={{ color: "var(--resto-text)" }}>
          <Gift className="size-5" style={{ color: "var(--resto-brand-text)" }} />
          My Rewards
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

      <div className="flex flex-col flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="size-8 animate-spin" style={{ color: "var(--resto-text-muted)" }} />
          </div>
        ) : error || !rewards ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--resto-error)" }}>
            Something went wrong while loading your rewards.
          </div>
        ) : (
          <>
            {/* Each tile — and the section below — only appears for a program
                the restaurant actually has switched on. A restaurant that's
                never enabled Scratch Cards must never show a permanent "0"
                tile implying the feature exists here. */}
            {rewards.loyaltyEnabled && (
              <div className="p-5 flex gap-4 border-b" style={{ borderColor: "var(--resto-divider)" }}>
                <div className="flex-1 rounded-lg border p-4 text-center" style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-surface-alt)" }}>
                  <p className="text-3xl font-bold resto-numeric" style={{ color: "var(--resto-brand-text)" }}>{rewards.pointsBalance}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--resto-text-muted)" }}>Loyalty Points</p>
                </div>
              </div>
            )}

            {rewards.scratchEnabled && (
              <div className="p-5 flex gap-3 border-b" style={{ borderColor: "var(--resto-divider)" }}>
                <div className="flex-1 rounded-lg border p-3 text-center" style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-surface-alt)" }}>
                  <p className="text-2xl font-bold resto-numeric" style={{ color: "var(--resto-brand-text)" }}>{rewards.totalScratchCards}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--resto-text-muted)" }}>Total Cards</p>
                </div>
                <div className="flex-1 rounded-lg border p-3 text-center" style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-surface-alt)" }}>
                  <p className="text-2xl font-bold resto-numeric" style={{ color: "var(--resto-brand-text)" }}>{rewards.unscratchedCardsCount}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--resto-text-muted)" }}>Unscratched</p>
                </div>
                <div className="flex-1 rounded-lg border p-3 text-center" style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-surface-alt)" }}>
                  <p className="text-2xl font-bold resto-numeric" style={{ color: "var(--resto-brand-text)" }}>{rewards.scratchedCardsCount}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--resto-text-muted)" }}>Scratched</p>
                </div>
              </div>
            )}

            {rewards.scratchEnabled && activeCards.length > 0 && (
              <div className="p-5 border-b" style={{ borderColor: "var(--resto-divider)" }}>
                <h3 className="resto-display text-sm font-semibold mb-4 flex items-center gap-1.5" style={{ color: "var(--resto-text)" }}>
                  <Sparkles className="size-4" style={{ color: "var(--resto-brand-text)" }} />
                  Scratch Cards
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* A plain tappable preview, not the live scratch canvas —
                      the actual scratch interaction happens full-screen (see
                      ScratchCardFullscreen), opened on tap. */}
                  {activeCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setOpenCardId(card.id)}
                      className="aspect-square rounded-xl border p-3 text-center transition-opacity hover:opacity-90"
                      style={{
                        borderColor: card.status === "ISSUED" ? "var(--resto-border)" : "var(--resto-brand-500)",
                        backgroundColor: "var(--resto-surface-alt)",
                      }}
                    >
                      <div className="flex h-full flex-col items-center justify-center gap-1">
                        <Sparkles className="size-5" style={{ color: "var(--resto-brand-text)" }} />
                        {card.status === "ISSUED" ? (
                          <p className="text-sm font-semibold" style={{ color: "var(--resto-text)" }}>
                            Scratch to Reveal
                          </p>
                        ) : (
                          <>
                            <p className="text-sm font-semibold" style={{ color: "var(--resto-text)" }}>
                              {card.reward?.label ?? "Reward"}
                            </p>
                            <p className="text-xs" style={{ color: "var(--resto-text-muted)" }}>
                              {card.reward?.type === "LOYALTY_POINTS" ? "Added to your points balance" : "Use at checkout"}
                            </p>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {openCardId &&
              (() => {
                const openCard = cards.find((c) => c.id === openCardId);
                if (!openCard) return null;
                return (
                  <ScratchCardFullscreen
                    card={openCard}
                    onReveal={() => scratch(openCard.id)}
                    onClose={() => setOpenCardId(null)}
                    revealFailed={revealError === openCard.id}
                    onRetryReveal={() => scratch(openCard.id)}
                  />
                );
              })()}

            <div className="p-5">
              <h3 className="resto-display text-sm font-semibold mb-4" style={{ color: "var(--resto-text)" }}>Reward History</h3>
              {rewards.history.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: "var(--resto-text-muted)" }}>No rewards history yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {rewards.history.map((item) => (
                    <li key={item.id} className="flex justify-between items-center py-2 border-b last:border-b-0" style={{ borderColor: "var(--resto-divider)" }}>
                      <div>
                        <p className="text-sm" style={{ color: "var(--resto-text)" }}>{item.description}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--resto-text-subtle)" }}>{new Date(item.date).toLocaleDateString()}</p>
                      </div>
                      <span className="text-sm font-semibold resto-numeric" style={{ color: item.amount > 0 ? "var(--resto-success)" : "var(--resto-text)" }}>
                        {item.amount > 0 ? "+" : ""}{item.amount} pt
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </OverlayShell>
  );
}
