"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LoyaltySettings = {
  /** Read-only here — Admin's own on/off switch (see restaurant-detail-panel.tsx / the restaurant's Settings > Rewards page header) controls this, not this form. */
  loyaltyEnabled: boolean;
  /** Direct multiplier: "0.1" earns 0.1 points per ₹1 spent — a ₹650 order earns floor(650 × 0.1) = 65 points. */
  earnRate: number;
  /** An order below this earns nothing at all — not fewer points, none. 0 = every order earns. */
  minOrderValueForRewards: number;
  rupeeValuePerPoint: number;
  expiryDays: number;
  maxBillPercentage: number;
  /** The customer's balance must be at least this many points before any redemption is allowed. 0 = no minimum. */
  minRedemptionPoints: number;
};

export function LoyaltySettingsForm({
  endpoint,
  initial,
}: {
  endpoint: string;
  initial: LoyaltySettings;
}) {
  const [earnRate, setEarnRate] = useState(initial.earnRate);
  const [minOrderValueForRewards, setMinOrderValueForRewards] = useState(initial.minOrderValueForRewards);
  const [rupeeValuePerPoint, setRupeeValuePerPoint] = useState(initial.rupeeValuePerPoint);
  const [expiryDays, setExpiryDays] = useState(initial.expiryDays);
  const [maxBillPercentage, setMaxBillPercentage] = useState(initial.maxBillPercentage);
  const [minRedemptionPoints, setMinRedemptionPoints] = useState(initial.minRedemptionPoints);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          earnRate: Number(earnRate),
          minOrderValueForRewards: Number(minOrderValueForRewards),
          rupeeValuePerPoint: Number(rupeeValuePerPoint),
          expiryDays: Number(expiryDays),
          maxBillPercentage: Number(maxBillPercentage),
          minRedemptionPoints: Number(minRedemptionPoints),
        }),
      });

      if (!res.ok) {
        toast.error("Could not save loyalty settings");
        return;
      }
      toast.success("Loyalty settings saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="size-4" />
          Loyalty Program
        </CardTitle>
        <CardDescription>
          Configure how customers earn and spend loyalty points.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="earn-rate">Points earned per ₹1 spent</Label>
              <Input
                id="earn-rate"
                type="number"
                min="0.01"
                step="0.01"
                value={earnRate}
                onChange={(e) => setEarnRate(Number(e.target.value))}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                e.g. 0.1 → a ₹650 order earns 65 points, simple as that.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rupee-value-per-point">Point value (₹ per point)</Label>
              <Input
                id="rupee-value-per-point"
                type="number"
                min="0.01"
                step="0.01"
                value={rupeeValuePerPoint}
                onChange={(e) => setRupeeValuePerPoint(Number(e.target.value))}
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expiry-days">Points Expiry (Days)</Label>
              <Input
                id="expiry-days"
                type="number"
                min="0"
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">0 means points never expire</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min-order-value">Minimum order value for rewards (₹)</Label>
              <Input
                id="min-order-value"
                type="number"
                min="0"
                value={minOrderValueForRewards}
                onChange={(e) => setMinOrderValueForRewards(Number(e.target.value))}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Orders below this earn nothing at all. 0 means every order earns.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max-bill">Max Bill Percentage</Label>
              <Input
                id="max-bill"
                type="number"
                min="0"
                max="100"
                value={maxBillPercentage}
                onChange={(e) => setMaxBillPercentage(Number(e.target.value))}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">Max % of bill that can be paid with points</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min-redemption-points">Minimum points to redeem</Label>
              <Input
                id="min-redemption-points"
                type="number"
                min="0"
                value={minRedemptionPoints}
                onChange={(e) => setMinRedemptionPoints(Number(e.target.value))}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                e.g. 20 → a customer with fewer points can&apos;t redeem at all. 0 means no minimum.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save Loyalty Settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
