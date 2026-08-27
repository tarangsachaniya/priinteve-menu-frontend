"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CampaignReward = {
  id: string;
  type: "POINTS" | "DISCOUNT" | "FREE_ITEM";
  value: number;
  weight: number;
  /** Required once type is FREE_ITEM — which menu item the customer gets free. */
  menuItemId?: string;
};

export type MenuItemOption = { id: string; name: string };

export type ScratchCampaignSettings = {
  campaignEnabled: boolean;
  name: string;
  startDate: string;
  endDate: string;
  maxCustomers: number;
  maxCards: number;
  rewards: CampaignReward[];
};

export function ScratchCampaignForm({
  endpoint,
  initial,
  menuItems = [],
}: {
  endpoint: string;
  initial: ScratchCampaignSettings;
  /** For the Free Item reward's menu-item picker. Empty is fine — that reward type just can't be added yet. */
  menuItems?: MenuItemOption[];
}) {
  const [enabled, setEnabled] = useState(initial.campaignEnabled);
  const [name, setName] = useState(initial.name);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [maxCustomers, setMaxCustomers] = useState(initial.maxCustomers);
  const [maxCards, setMaxCards] = useState(initial.maxCards);
  const [rewards, setRewards] = useState<CampaignReward[]>(initial.rewards);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    const incomplete = rewards.find(rewardIsIncomplete);
    if (incomplete) {
      toast.error("Choose a menu item for every Free Item reward");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignEnabled: enabled,
          name,
          startDate,
          endDate,
          maxCustomers: Number(maxCustomers),
          maxCards: Number(maxCards),
          rewards,
        }),
      });

      if (!res.ok) {
        toast.error("Could not save scratch campaign");
        return;
      }
      toast.success("Scratch campaign saved");
    } finally {
      setBusy(false);
    }
  }

  function addReward() {
    setRewards([...rewards, { id: Date.now().toString(), type: "POINTS", value: 10, weight: 1 }]);
  }

  function removeReward(id: string) {
    setRewards(rewards.filter((r) => r.id !== id));
  }

  function updateReward(id: string, field: keyof CampaignReward, val: string | number) {
    setRewards(rewards.map((r) => r.id === id ? { ...r, [field]: val } : r));
  }

  function rewardIsIncomplete(reward: CampaignReward) {
    return reward.type === "FREE_ITEM" && !reward.menuItemId;
  }

  // A raw "weight" of 54 means nothing on its own — it's only meaningful
  // relative to the other rewards' weights. Shown live next to each row so
  // an owner can see the actual odds they're setting, not just a number.
  const totalWeight = rewards.reduce((sum, r) => sum + (Number.isFinite(r.weight) ? r.weight : 0), 0);
  function chancePercent(weight: number) {
    if (totalWeight <= 0) return 0;
    return Math.round((weight / totalWeight) * 1000) / 10; // one decimal place
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          Scratch Card Campaign
        </CardTitle>
        <CardDescription>
          Run a scratch card campaign to reward customers for ordering.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="campaign-enabled">Enable Campaign</Label>
            </div>
            <Switch
              id="campaign-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max-customers">Max Customers</Label>
              <Input
                id="max-customers"
                type="number"
                min="0"
                value={maxCustomers}
                onChange={(e) => setMaxCustomers(Number(e.target.value))}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max-cards">Max Cards (Total)</Label>
              <Input
                id="max-cards"
                type="number"
                min="0"
                value={maxCards}
                onChange={(e) => setMaxCards(Number(e.target.value))}
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <Label>Rewards (Probabilities)</Label>
              <p className="text-xs text-muted-foreground">
                Weight sets the odds of winning each reward, relative to the others — it isn&apos;t a
                percentage by itself. The chance shown updates as you type.
              </p>
            </div>

            {rewards.length > 0 && (
              <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:flex">
                <span className="flex-1">Reward type</span>
                <span className="flex-1">Value</span>
                <span className="flex-1">Weight → chance of winning</span>
                <span className="w-9" />
              </div>
            )}

            {rewards.map((reward) => (
              <div key={reward.id} className="flex items-center gap-2 border p-3 rounded-md">
                <div className="flex-1">
                  <Select
                    value={reward.type}
                    onValueChange={(val) => {
                      if (val) updateReward(reward.id, "type", val);
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POINTS">Points</SelectItem>
                      <SelectItem value="DISCOUNT">Discount %</SelectItem>
                      <SelectItem value="FREE_ITEM">Free Item</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {reward.type === "FREE_ITEM" ? (
                  <div className="flex-1">
                    <Select
                      value={reward.menuItemId ?? ""}
                      onValueChange={(val) => {
                        if (val) updateReward(reward.id, "menuItemId", val);
                      }}
                      disabled={busy || menuItems.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={menuItems.length === 0 ? "No menu items yet" : "Choose item"} />
                      </SelectTrigger>
                      <SelectContent>
                        {menuItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Value"
                      value={reward.value}
                      onChange={(e) => updateReward(reward.id, "value", Number(e.target.value))}
                      disabled={busy}
                    />
                  </div>
                )}
                <div className="flex flex-1 items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    placeholder="Weight"
                    value={reward.weight}
                    onChange={(e) => updateReward(reward.id, "weight", Number(e.target.value))}
                    disabled={busy}
                    className="min-w-0"
                  />
                  <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">
                    ≈ {chancePercent(reward.weight)}%
                  </span>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeReward(reward.id)} disabled={busy}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addReward} disabled={busy} className="self-start">
              <Plus className="size-4 mr-2" />
              Add Reward
            </Button>
          </div>

          <div className="flex gap-2 mt-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save Campaign"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
