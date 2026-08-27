"use client";

import { useEffect, useState } from "react";
import { Gift, X, Loader2 } from "lucide-react";
import { OverlayShell } from "@/components/order/overlay-shell";

type RewardHistory = {
  id: string;
  amount: number; // positive or negative
  description: string;
  date: string;
};

export type RewardsData = {
  pointsBalance: number;
  unscratchedCardsCount: number;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!customer) return;

    let cancelled = false;
    setIsLoading(true);
    setError(false);

    (async () => {
      try {
        const res = await fetch(`/api/order/rewards/me?restaurantSlug=${restaurantSlug}`);
        if (!res.ok) {
          throw new Error("Failed to load rewards");
        }
        const data = await res.json();
        if (!cancelled) {
          setRewards({
            pointsBalance: data.pointsBalance || 0,
            unscratchedCardsCount: data.unscratchedCardsCount || 0,
            history: data.history || [],
          });
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customer, restaurantSlug]);

  return (
    <OverlayShell tone="rewards" label="My Rewards" onClose={onClose}>
      <header
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: "var(--resto-border)" }}
      >
        <h2 className="resto-display text-xl font-semibold flex items-center gap-2" style={{ color: "var(--resto-text)" }}>
          <Gift className="size-5" style={{ color: "var(--resto-brand-500)" }} />
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
            <div className="p-5 flex gap-4 border-b" style={{ borderColor: "var(--resto-divider)" }}>
              <div className="flex-1 rounded-lg border p-4 text-center" style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-surface-alt)" }}>
                <p className="text-3xl font-bold resto-numeric" style={{ color: "var(--resto-brand-500)" }}>{rewards.pointsBalance}</p>
                <p className="text-xs mt-1" style={{ color: "var(--resto-text-muted)" }}>Loyalty Points</p>
              </div>
              <div className="flex-1 rounded-lg border p-4 text-center" style={{ borderColor: "var(--resto-border)", backgroundColor: "var(--resto-surface-alt)" }}>
                <p className="text-3xl font-bold resto-numeric" style={{ color: "var(--resto-brand-500)" }}>{rewards.unscratchedCardsCount}</p>
                <p className="text-xs mt-1" style={{ color: "var(--resto-text-muted)" }}>Scratch Cards</p>
              </div>
            </div>
            
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
                      <span className={`text-sm font-semibold resto-numeric ${item.amount > 0 ? "" : ""}`} style={{ color: item.amount > 0 ? "var(--resto-success)" : "var(--resto-text)" }}>
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
