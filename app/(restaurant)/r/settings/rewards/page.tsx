import { serverFetch } from "@/lib/api/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Ticket, Activity, Gift } from "lucide-react";

import { LoyaltySettingsForm, type LoyaltySettings } from "@/components/restaurant/loyalty-settings-form";
import { ScratchCampaignForm, type MenuItemOption, type ScratchCampaignSettings } from "@/components/restaurant/scratch-campaign-form";

export const dynamic = "force-dynamic";

type RewardsMetrics = {
  loyalty: { issued: number; redeemed: number; expired: number };
  scratchCards: { issued: number; revealed: number; redeemed: number; expired: number };
};

type ScratchCampaignResponse = { isEnabled: boolean; campaign: ScratchCampaignSettings };

const EMPTY_METRICS: RewardsMetrics = {
  loyalty: { issued: 0, redeemed: 0, expired: 0 },
  scratchCards: { issued: 0, revealed: 0, redeemed: 0, expired: 0 },
};

export default async function RewardsSettingsPage() {
  // Independent, fault-tolerant reads — a still-deploying route missing
  // shouldn't take the whole page down, same convention every other
  // Settings page here already follows.
  const [metrics, loyalty, scratch, menuItemsData] = await Promise.all([
    serverFetch<RewardsMetrics>("/api/restaurant/rewards/metrics", { cache: "no-store" }).catch(() => EMPTY_METRICS),
    serverFetch<LoyaltySettings>("/api/restaurant/loyalty/settings", { cache: "no-store" }).catch(() => null),
    serverFetch<ScratchCampaignResponse>("/api/restaurant/scratch/campaign", { cache: "no-store" }).catch(() => null),
    serverFetch<{ items: MenuItemOption[] }>("/api/restaurant/menu-items", { cache: "no-store" }).catch(() => ({ items: [] })),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Loyalty Points</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Issued</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.loyalty.issued.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Lifetime points given to customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Redeemed</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.loyalty.redeemed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Points spent by customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Expired</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.loyalty.expired.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Unused points that expired</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          {loyalty && loyalty.loyaltyEnabled ? (
            <LoyaltySettingsForm endpoint="/api/restaurant/loyalty/settings" initial={loyalty} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
                <Gift className="size-5 shrink-0" />
                Loyalty Points isn&apos;t enabled for your restaurant yet. Ask Priinteve to turn it on, then
                come back here to set your own rates.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Scratch Cards</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issued</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.scratchCards.issued.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revealed</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.scratchCards.revealed.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Redeemed</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.scratchCards.redeemed.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.scratchCards.expired.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          {scratch && scratch.isEnabled ? (
            <ScratchCampaignForm endpoint="/api/restaurant/scratch/campaign" initial={scratch.campaign} menuItems={menuItemsData.items} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
                <Ticket className="size-5 shrink-0" />
                Scratch Cards isn&apos;t enabled for your restaurant yet. Ask Priinteve to turn it on, then
                come back here to set up your campaign.
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
