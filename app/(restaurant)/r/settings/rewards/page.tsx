import { serverFetch } from "@/lib/api/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Ticket, Activity, Gift } from "lucide-react";

export const dynamic = "force-dynamic";

type RewardsMetrics = {
  loyalty: {
    issued: number;
    redeemed: number;
    expired: number;
  };
  scratchCards: {
    issued: number;
    revealed: number;
    redeemed: number;
    expired: number;
  };
};

// Mock data fetch for now as backend might not be ready
async function getRewardsMetrics(): Promise<RewardsMetrics> {
  try {
    const data = await serverFetch<RewardsMetrics>("/api/restaurant/rewards/metrics", { cache: "no-store" });
    return data;
  } catch {
    // Return mock data if API fails or is not implemented yet
    return {
      loyalty: {
        issued: 12500,
        redeemed: 8400,
        expired: 1200,
      },
      scratchCards: {
        issued: 450,
        revealed: 380,
        redeemed: 150,
        expired: 25,
      }
    };
  }
}

export default async function RewardsSettingsPage() {
  const metrics = await getRewardsMetrics();

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
      </section>
    </div>
  );
}
