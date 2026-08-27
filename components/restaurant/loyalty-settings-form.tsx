"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type LoyaltySettings = {
  loyaltyEnabled: boolean;
  pointsPerRupee: number;
  rupeeValuePerPoint: number;
  expiryDays: number;
  maxPointsRedemption: number;
  maxBillPercentage: number;
};

export function LoyaltySettingsForm({
  endpoint,
  initial,
}: {
  endpoint: string;
  initial: LoyaltySettings;
}) {
  const [enabled, setEnabled] = useState(initial.loyaltyEnabled);
  const [pointsPerRupee, setPointsPerRupee] = useState(initial.pointsPerRupee);
  const [rupeeValuePerPoint, setRupeeValuePerPoint] = useState(initial.rupeeValuePerPoint);
  const [expiryDays, setExpiryDays] = useState(initial.expiryDays);
  const [maxPointsRedemption, setMaxPointsRedemption] = useState(initial.maxPointsRedemption);
  const [maxBillPercentage, setMaxBillPercentage] = useState(initial.maxBillPercentage);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loyaltyEnabled: enabled,
          pointsPerRupee: Number(pointsPerRupee),
          rupeeValuePerPoint: Number(rupeeValuePerPoint),
          expiryDays: Number(expiryDays),
          maxPointsRedemption: Number(maxPointsRedemption),
          maxBillPercentage: Number(maxBillPercentage),
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="loyalty-enabled">Enable Loyalty Program</Label>
              <p className="text-xs text-muted-foreground">
                Customers will earn and can redeem points when this is on.
              </p>
            </div>
            <Switch
              id="loyalty-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="points-per-rupee">Spend required per point (₹)</Label>
              <Input
                id="points-per-rupee"
                type="number"
                min="0"
                step="0.01"
                value={pointsPerRupee}
                onChange={(e) => setPointsPerRupee(Number(e.target.value))}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rupee-value-per-point">Point value (₹ per point)</Label>
              <Input
                id="rupee-value-per-point"
                type="number"
                min="0"
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
              <Label htmlFor="max-points">Max Points Redemption</Label>
              <Input
                id="max-points"
                type="number"
                min="0"
                value={maxPointsRedemption}
                onChange={(e) => setMaxPointsRedemption(Number(e.target.value))}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">Max points a user can redeem in one order</p>
            </div>
          </div>

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
