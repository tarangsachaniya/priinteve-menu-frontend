"use client";

import { useEffect, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

type LoyaltyCalc = {
  eligible: boolean;
  reason?: string;
  maxPoints: number;
  maxDiscount: number;
  availablePoints: number;
};

type ScratchCard = {
  id: string;
  status: string;
  reward: { type: string; label: string } | null;
};

/**
 * Redeeming loyalty points or a scratch-card reward against THIS order.
 *
 * Only shown while the order is still PENDING — priinteve-api only allows
 * redemption in that window (before the restaurant requests payment), so
 * there is nowhere earlier (checkout, before the order exists) or later
 * (once payment is open) that this could correctly live. See
 * order-status-tracker.tsx for where this is mounted.
 */
export function RewardRedemption({
  restaurantSlug,
  orderId,
  onRedeemed,
}: {
  restaurantSlug: string;
  orderId: string;
  /** Called with the order's new total after a successful redemption. */
  onRedeemed: (newTotal: number) => void;
}) {
  const [loyalty, setLoyalty] = useState<LoyaltyCalc | null>(null);
  const [cards, setCards] = useState<ScratchCard[]>([]);
  // Defaults to the full eligible amount — a customer who just wants to use
  // everything taps "Redeem" with no extra step; the field is editable for
  // anyone who wants to hold some points back.
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [loyaltyApplied, setLoyaltyApplied] = useState(false);
  const [redeemedCardId, setRedeemedCardId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"points" | string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [loyaltyRes, cardsRes] = await Promise.all([
          fetch("/api/order/loyalty/calculate-redemption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantSlug, orderId }),
          }),
          fetch(`/api/order/scratch/cards?restaurantSlug=${restaurantSlug}`),
        ]);

        const loyaltyData = await loyaltyRes.json().catch(() => null);
        const cardsData = await cardsRes.json().catch(() => null);

        if (!cancelled) {
          if (loyaltyRes.ok && loyaltyData) {
            setLoyalty(loyaltyData);
            setPointsToRedeem(loyaltyData.maxPoints ?? 0);
          }
          if (cardsRes.ok && cardsData?.cards) {
            setCards(cardsData.cards.filter((card: ScratchCard) => card.status === "AVAILABLE"));
          }
        }
      } catch {
        // Rewards are a convenience on top of ordering — a failed fetch here
        // must never block or clutter the order-status page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, orderId]);

  async function redeemPoints() {
    if (!loyalty || pointsToRedeem <= 0 || pointsToRedeem > loyalty.maxPoints) return;
    setBusy("points");
    try {
      const res = await fetch("/api/order/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug, orderId, points: pointsToRedeem }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not redeem points");
        return;
      }
      toast.success("Points Redeemed Successfully", { description: `${pointsToRedeem} points redeemed` });
      setLoyaltyApplied(true);
      onRedeemed(data.order.total);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function undoRedeemPoints() {
    setBusy("points");
    try {
      const res = await fetch("/api/order/loyalty/undo-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug, orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not remove this redemption");
        return;
      }
      toast.success("Redemption removed");
      setLoyaltyApplied(false);
      onRedeemed(data.order.total);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function redeemCard(cardId: string) {
    setBusy(cardId);
    try {
      const res = await fetch(`/api/order/scratch/${cardId}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not redeem this reward");
        return;
      }
      toast.success("Reward applied");
      setRedeemedCardId(cardId);
      if (data.order && typeof data.order.total === "number") onRedeemed(data.order.total);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return null;

  const hasLoyalty = Boolean(loyalty?.eligible && loyalty.maxPoints > 0);
  // A customer with a real balance who still can't redeem (e.g. below the
  // configured minimum) gets told why, rather than the section just vanishing
  // as if they had no points at all.
  const showIneligibleReason = Boolean(loyalty && !loyalty.eligible && loyalty.availablePoints > 0 && loyalty.reason);
  const hasCards = cards.length > 0;
  if (!hasLoyalty && !showIneligibleReason && !hasCards) return null;

  return (
    <section
      className="flex flex-col gap-3 border p-4"
      style={{
        backgroundColor: "var(--resto-surface)",
        borderColor: "var(--resto-border)",
        borderRadius: "var(--resto-radius-lg)",
      }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--resto-text)" }}>
        Redeem rewards
      </h2>

      {showIneligibleReason && loyalty && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
          <Gift className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {loyalty.availablePoints} points available · {loyalty.reason}
          </span>
        </div>
      )}

      {hasLoyalty && loyalty && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Gift className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              {loyalty.availablePoints} points available · up to {loyalty.maxPoints} usable on this order
            </span>
          </div>

          {loyaltyApplied ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-600">
                Redeemed {pointsToRedeem} points · saved{" "}
                {formatCurrency(Math.floor((pointsToRedeem * loyalty.maxDiscount) / loyalty.maxPoints))}
              </span>
              <Button type="button" size="xs" variant="outline" disabled={busy !== null} onClick={undoRedeemPoints}>
                {busy === "points" ? "Removing…" : "Remove"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={loyalty.maxPoints}
                value={pointsToRedeem}
                disabled={busy !== null}
                onChange={(e) => {
                  const next = Math.round(Number(e.target.value));
                  if (!Number.isFinite(next)) return;
                  setPointsToRedeem(Math.min(loyalty.maxPoints, Math.max(1, next)));
                }}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums"
                aria-label="Points to redeem"
              />
              <button
                type="button"
                onClick={() => setPointsToRedeem(loyalty.maxPoints)}
                disabled={busy !== null || pointsToRedeem === loyalty.maxPoints}
                className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
              >
                Use all {loyalty.maxPoints}
              </button>
              <span className="flex-1 text-right text-xs text-muted-foreground">
                save {formatCurrency(Math.floor((pointsToRedeem * loyalty.maxDiscount) / loyalty.maxPoints))}
              </span>
              <Button
                type="button"
                size="xs"
                disabled={busy !== null || pointsToRedeem <= 0 || pointsToRedeem > loyalty.maxPoints}
                onClick={redeemPoints}
              >
                {busy === "points" ? "Applying…" : "Redeem"}
              </Button>
            </div>
          )}
        </div>
      )}

      {hasCards &&
        cards.map((card) => (
          <div key={card.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-muted-foreground" aria-hidden />
              <span>{card.reward?.label ?? "Scratch card reward"}</span>
            </div>
            <Button
              type="button"
              size="xs"
              variant={redeemedCardId === card.id ? "outline" : "default"}
              disabled={redeemedCardId !== null || busy !== null}
              onClick={() => redeemCard(card.id)}
            >
              {redeemedCardId === card.id ? "Applied" : busy === card.id ? "Applying…" : "Redeem"}
            </Button>
          </div>
        ))}
    </section>
  );
}
