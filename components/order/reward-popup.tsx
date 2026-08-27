"use client";

import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";
import { OverlayShell } from "@/components/order/overlay-shell";

export type RewardsData = {
  pointsBalance: number;
  unscratchedCardsCount: number;
};

export function RewardPopup({
  restaurantSlug,
  customer,
  onOpenMyRewards,
}: {
  restaurantSlug: string;
  customer: { name: string; mobile: string } | null;
  onOpenMyRewards: () => void;
}) {
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!customer) return;

    // Only show once per session for this restaurant
    const sessionKey = `reward_popup_shown_${restaurantSlug}`;
    if (sessionStorage.getItem(sessionKey)) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/order/rewards/me?restaurantSlug=${restaurantSlug}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (!cancelled && data && (data.pointsBalance > 0 || data.unscratchedCardsCount > 0)) {
          setRewards({
            pointsBalance: data.pointsBalance || 0,
            unscratchedCardsCount: data.unscratchedCardsCount || 0,
          });
          setIsOpen(true);
          sessionStorage.setItem(sessionKey, "true");
        }
      } catch {
        // silently fail
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customer, restaurantSlug]);

  if (!isOpen || !rewards) return null;

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleOpenRewards = () => {
    setIsOpen(false);
    onOpenMyRewards();
  };

  return (
    <OverlayShell tone="rewards" label="Your Rewards" onClose={handleClose}>
      <header
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: "var(--resto-border)" }}
      >
        <h2 className="resto-display text-xl font-semibold flex items-center gap-2" style={{ color: "var(--resto-text)" }}>
          <Gift className="size-5" style={{ color: "var(--resto-brand-500)" }} />
          Welcome back!
        </h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="rounded-full p-1 transition-opacity hover:opacity-70"
          style={{ color: "var(--resto-text-muted)" }}
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
          You have rewards waiting for you at this restaurant!
        </p>
        
        <div className="flex gap-4">
          {rewards.pointsBalance > 0 && (
            <div className="flex-1 rounded-lg border p-4 text-center" style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-surface-alt)" }}>
              <p className="text-2xl font-bold resto-numeric" style={{ color: "var(--resto-brand-500)" }}>{rewards.pointsBalance}</p>
              <p className="text-xs mt-1" style={{ color: "var(--resto-text-muted)" }}>Loyalty Points</p>
            </div>
          )}
          
          {rewards.unscratchedCardsCount > 0 && (
            <div className="flex-1 rounded-lg border p-4 text-center" style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-surface-alt)" }}>
              <p className="text-2xl font-bold resto-numeric" style={{ color: "var(--resto-brand-500)" }}>{rewards.unscratchedCardsCount}</p>
              <p className="text-xs mt-1" style={{ color: "var(--resto-text-muted)" }}>Scratch Cards</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleOpenRewards}
          className="mt-2 w-full rounded-full py-3 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: "var(--resto-brand-500)",
            color: "var(--on-brand)",
          }}
        >
          View My Rewards
        </button>
      </div>
    </OverlayShell>
  );
}
