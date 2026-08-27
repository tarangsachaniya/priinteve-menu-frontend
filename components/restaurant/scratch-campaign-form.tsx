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
  /** How many of this specific reward may ever be won, campaign-wide. Unset/0 = unlimited. */
  maxQuantity?: number;
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

  // base-ui's Select.Value falls back to the raw value string when no
  // matching mounted <SelectItem> is found (empty/stale menuItems list, or a
  // dish that's since been deleted) — this is what stopped that id ever
  // showing up in the trigger.
  function menuItemLabel(menuItemId: string | undefined) {
    if (!menuItemId) return "";
    return menuItems.find((item) => item.id === menuItemId)?.name ?? "Unknown item";
  }

  // A raw "weight" of 54 means nothing on its own — it's only meaningful
  // relative to the other rewards' weights. Shown live next to each row so
  // an owner can see the actual odds they're setting, not just a number.
  const totalWeight = rewards.reduce((sum, r) => sum + (Number.isFinite(r.weight) ? r.weight : 0), 0);
  function chancePercent(weight: number) {
    if (totalWeight <= 0) return 0;
    return Math.round((weight / totalWeight) * 1000) / 10; // one decimal place
  }

  /**
   * The reverse direction: typing a percentage solves for the weight that
   * would produce it, holding every OTHER reward's weight fixed. Editing one
   * reward's chance still shifts the others' *share* of the new total (their
   * raw weight doesn't move, but the pie is now cut differently) — the same
   * way any relative-odds system works, and is called out in the caption
   * below so it doesn't read as a bug.
   */
  function setChancePercent(id: string, percentInput: number) {
    const current = rewards.find((r) => r.id === id);
    if (!current) return;
    const otherSum = totalWeight - (Number.isFinite(current.weight) ? current.weight : 0);

    // Only reward in the list (or every other weight is 0) — its chance is
    // always 100% no matter what its own weight is; nothing to solve for.
    if (otherSum <= 0) return;

    const p = Math.min(99, Math.max(1, percentInput)) / 100;
    const newWeight = Math.max(1, Math.round((p * otherSum) / (1 - p)));
    updateReward(id, "weight", newWeight);
  }

  // What the user asked "add a total" for: how many cards this campaign will
  // actually hand out across all its reward tiers, so it's easy to sanity-check
  // against "Max Cards (Total)" above without doing the arithmetic by hand.
  const hasUnlimitedReward = rewards.some((r) => !r.maxQuantity || r.maxQuantity <= 0);
  const totalConfiguredQuantity = rewards.reduce((sum, r) => sum + (r.maxQuantity && r.maxQuantity > 0 ? r.maxQuantity : 0), 0);
  const exceedsMaxCards = maxCards > 0 && !hasUnlimitedReward && totalConfiguredQuantity > maxCards;

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
                Set the odds either way — type a Weight (relative to the other rewards) or type the
                Chance % directly and the weight is worked out for you. Editing one reward&apos;s
                chance shifts how the others split the remaining odds, same as any relative system.
              </p>
            </div>

            {rewards.length > 0 && (
              <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:flex">
                <span className="flex-1">Reward type</span>
                <span className="flex-1">Value</span>
                <span className="flex-1">Weight</span>
                <span className="flex-1">Chance of winning</span>
                <span className="flex-1">Max quantity</span>
                <span className="w-9" />
              </div>
            )}

            {rewards.map((reward) => (
              <div key={reward.id} className="flex flex-col gap-2 border p-3 rounded-md">
                <div className="flex items-center gap-2">
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
                  {reward.type !== "FREE_ITEM" && (
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
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeReward(reward.id)} disabled={busy}>
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>

                {/* Odds + stock cap — its own line so both ways of setting the
                    odds (weight or chance %) get room to be properly labelled,
                    rather than a bare number next to a "≈" nobody explained. */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Weight</span>
                    <Input
                      type="number"
                      min="0"
                      value={reward.weight}
                      onChange={(e) => updateReward(reward.id, "weight", Number(e.target.value))}
                      disabled={busy}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Chance of winning</span>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        max="99"
                        step="0.1"
                        value={chancePercent(reward.weight)}
                        onChange={(e) => setChancePercent(reward.id, Number(e.target.value))}
                        disabled={busy || rewards.length < 2}
                        className="pr-6"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Max quantity</span>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Unlimited"
                      value={reward.maxQuantity ?? ""}
                      onChange={(e) => updateReward(reward.id, "maxQuantity", e.target.value === "" ? 0 : Number(e.target.value))}
                      disabled={busy}
                    />
                  </div>
                </div>

                {/* Its own full-width row, not squeezed into the Value column
                    above — item names run much longer than a discount % or a
                    points count ever would. */}
                {reward.type === "FREE_ITEM" && (
                  <div className="flex flex-col gap-1">
                    <Select
                      value={reward.menuItemId ?? ""}
                      onValueChange={(val) => {
                        if (val) updateReward(reward.id, "menuItemId", val);
                      }}
                      disabled={busy || menuItems.length === 0}
                    >
                      <SelectTrigger>
                        {/* The value/id is looked up against the live menuItems
                            list explicitly — left to base-ui's own default, an
                            id with no matching mounted <SelectItem> (e.g. the
                            dish was deleted, or the list hadn't loaded yet)
                            renders as the raw id string instead of a name. */}
                        <SelectValue placeholder={menuItems.length === 0 ? "No menu items yet" : "Choose the free item"}>
                          {(value: string) => menuItemLabel(value)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {menuItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {reward.menuItemId && !menuItems.some((item) => item.id === reward.menuItemId) && (
                      <p className="text-xs text-destructive">
                        This item no longer exists on your menu — choose another.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {rewards.length > 0 && (
              <div
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
                  exceedsMaxCards ? "border-destructive text-destructive" : "text-muted-foreground"
                }`}
              >
                <span>Total scratch cards across all rewards</span>
                <span className="font-semibold tabular-nums">
                  {totalConfiguredQuantity}
                  {hasUnlimitedReward ? " + unlimited" : ""}
                  {maxCards > 0 && ` / ${maxCards} max`}
                </span>
              </div>
            )}
            {exceedsMaxCards && (
              <p className="text-xs text-destructive">
                That&apos;s more than &quot;Max Cards (Total)&quot; above allows — some rewards will run
                out before the campaign does, or raise the cap.
              </p>
            )}

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
