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
};

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
}: {
  endpoint: string;
  initial: ScratchCampaignSettings;
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
            <Label>Rewards (Probabilities)</Label>
            {rewards.map((reward) => (
              <div key={reward.id} className="flex items-center gap-2 border p-3 rounded-md">
                <div className="flex-1">
                  <Select
                    value={reward.type}
                    onValueChange={(val) => {
                      if (val) updateReward(reward.id, "type", val as any);
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
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Value"
                    value={reward.value}
                    onChange={(e) => updateReward(reward.id, "value", Number(e.target.value))}
                    disabled={busy}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Weight/Prob"
                    value={reward.weight}
                    onChange={(e) => updateReward(reward.id, "weight", Number(e.target.value))}
                    disabled={busy}
                  />
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
