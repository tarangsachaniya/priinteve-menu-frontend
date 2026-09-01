"use client";

import { useEffect, useState } from "react";
import { Gift, Sparkles } from "lucide-react";

import { formatCurrency } from "@/lib/format";

type LoyaltyCalc = {
  eligible: boolean;
  reason?: string;
  maxPoints: number;
  maxDiscount: number;
  rupeeValuePerPoint: number;
  availablePoints: number;
};

type ScratchCardReward = {
  type: string;
  label: string;
  percentValue: number | null;
  maxDiscountAmount: number | null;
  amountValue: number | null;
};

type ScratchCard = {
  id: string;
  status: string;
  reward: ScratchCardReward | null;
};

export type RewardSelectionValue = {
  /** 0 means "not redeeming points" — distinct from picking a value and unchecking. */
  pointsToRedeem: number;
  scratchCardId: string | null;
  /**
   * Best-effort preview only, for what the checkout summary shows before
   * Place Order — never trusted for the actual charge. The real discount is
   * computed and applied server-side at order creation (place.routes.ts),
   * against redeemLoyaltyPoints()/redeemScratchCard() re-deriving everything
   * from scratch — see calculateLoyaltyRedemption's own comment on why a
   * pre-order figure can only ever be a preview.
   */
  estimatedDiscount: number;
};

const EMPTY: RewardSelectionValue = { pointsToRedeem: 0, scratchCardId: null, estimatedDiscount: 0 };

/**
 * Pre-order reward picker for the checkout drawer — chooses WHAT to redeem,
 * alongside the note field, before the order exists. The actual spend
 * happens server-side the moment Place Order creates a real order to redeem
 * against (place.routes.ts calls the same redeemLoyaltyPoints()/
 * redeemScratchCard() the order-status page's own post-order "Redeem
 * rewards" step uses — see reward-redemption.tsx, still mounted there as a
 * fallback for whenever this pick couldn't be applied, or wasn't made).
 */
export function RewardSelection({
  restaurantSlug,
  billAmount,
  deliveryFee,
  onChange,
}: {
  restaurantSlug: string;
  /** The cart's current subtotal — the same figure loyalty's config caps redemption against, and what the order will actually be created with. */
  billAmount: number;
  /** So a FREE_DELIVERY reward's preview can show its real rupee value. */
  deliveryFee: number;
  onChange: (value: RewardSelectionValue) => void;
}) {
  const [loyalty, setLoyalty] = useState<LoyaltyCalc | null>(null);
  const [cards, setCards] = useState<ScratchCard[]>([]);
  const [wantsLoyalty, setWantsLoyalty] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [loyaltyRes, cardsRes] = await Promise.all([
          fetch("/api/order/loyalty/calculate-redemption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantSlug, billAmount }),
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
        // must never block checkout. The section just stays empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // billAmount changes as the guest edits the cart from another tab in
    // rare cases, but re-fetching on every keystroke of unrelated checkout
    // fields would be wasteful — refetch is keyed on the values that
    // actually change the eligible amount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug, billAmount]);

  const selectedCard = selectedCardId ? (cards.find((card) => card.id === selectedCardId) ?? null) : null;

  useEffect(() => {
    const loyaltyDiscount =
      wantsLoyalty && loyalty && loyalty.maxPoints > 0
        ? Math.floor((Math.min(pointsToRedeem, loyalty.maxPoints) * loyalty.maxDiscount) / loyalty.maxPoints)
        : 0;
    const cardDiscount = estimateCardDiscount(selectedCard, billAmount, deliveryFee);

    onChange({
      pointsToRedeem: wantsLoyalty ? pointsToRedeem : 0,
      scratchCardId: selectedCardId,
      estimatedDiscount: loyaltyDiscount + cardDiscount,
    });
    // onChange is provided fresh every render by the parent; including it
    // would refire this on every keystroke elsewhere in the drawer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsLoyalty, pointsToRedeem, selectedCardId, loyalty, billAmount, deliveryFee]);

  if (loading) return null;

  const hasLoyalty = Boolean(loyalty?.eligible && loyalty.maxPoints > 0);
  const hasCards = cards.length > 0;
  if (!hasLoyalty && !hasCards) return null;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Redeem rewards (optional)</h3>

      {hasLoyalty && loyalty && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wantsLoyalty}
              onChange={(e) => setWantsLoyalty(e.target.checked)}
              className="size-4"
            />
            <Gift className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              {loyalty.availablePoints} points available · up to {loyalty.maxPoints} usable on this order
              {loyalty.rupeeValuePerPoint > 0 && ` · 1 point = ${formatCurrency(loyalty.rupeeValuePerPoint)}`}
            </span>
          </label>

          {wantsLoyalty && (
            <div className="flex items-center gap-2 pl-6">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={loyalty.maxPoints}
                value={pointsToRedeem}
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
                disabled={pointsToRedeem === loyalty.maxPoints}
                className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
              >
                Use all {loyalty.maxPoints}
              </button>
              <span className="flex-1 text-right text-xs text-muted-foreground">
                save {formatCurrency(Math.floor((Math.min(pointsToRedeem, loyalty.maxPoints) * loyalty.maxDiscount) / loyalty.maxPoints))}
              </span>
            </div>
          )}
        </div>
      )}

      {hasCards &&
        cards.map((card) => {
          const selected = selectedCardId === card.id;
          const estimate = estimateCardDiscount(card, billAmount, deliveryFee);
          return (
            <label
              key={card.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reward-scratch-card"
                  checked={selected}
                  onChange={() => setSelectedCardId(selected ? null : card.id)}
                  className="size-4"
                />
                <Sparkles className="size-4 text-muted-foreground" aria-hidden />
                {card.reward?.label ?? "Scratch card reward"}
              </span>
              {estimate > 0 && <span className="text-xs text-muted-foreground">save {formatCurrency(estimate)}</span>}
            </label>
          );
        })}
    </section>
  );
}

/**
 * A same-formula preview of what redeemScratchCard() would compute, for the
 * three reward shapes cheap enough to estimate from data this page already
 * has (see toCardView() in scratch-cards.ts, which already returns
 * percentValue/maxDiscountAmount/amountValue). FREE_ITEM needs a real order
 * line to price against and LOYALTY_POINTS/CUSTOM_REWARD/BRAND_REWARD don't
 * discount the bill at all — those simply show no estimate, same as this
 * component's post-order counterpart (reward-redemption.tsx) already does
 * for every scratch-card reward, computed or not.
 */
function estimateCardDiscount(card: ScratchCard | null, billAmount: number, deliveryFee: number): number {
  if (!card?.reward) return 0;
  switch (card.reward.type) {
    case "PERCENTAGE_DISCOUNT": {
      let discount = Math.floor((billAmount * (card.reward.percentValue ?? 0)) / 100);
      if (card.reward.maxDiscountAmount != null) discount = Math.min(discount, card.reward.maxDiscountAmount);
      return discount;
    }
    case "FIXED_DISCOUNT":
      return card.reward.amountValue ?? 0;
    case "FREE_DELIVERY":
      return deliveryFee;
    default:
      return 0;
  }
}

export { EMPTY as EMPTY_REWARD_SELECTION };
