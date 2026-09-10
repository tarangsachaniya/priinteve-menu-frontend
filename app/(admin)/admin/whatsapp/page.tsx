import { IndianRupee, MessageCircle, Store } from "lucide-react";

import { serverFetch } from "@/lib/api/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { WhatsappPlatformTable, type WhatsappRollupRow } from "@/components/restaurant/admin/whatsapp-platform-table";

export const dynamic = "force-dynamic";

type PlatformSummary = { restaurantsEnabled: number; messagesThisMonth: number; revenueThisMonth: number; month: string };

const EMPTY_SUMMARY: PlatformSummary = { restaurantsEnabled: 0, messagesThisMonth: 0, revenueThisMonth: 0, month: "" };

export default async function AdminWhatsappPage() {
  const [summary, rollup] = await Promise.all([
    serverFetch<PlatformSummary>("/api/admin/whatsapp/summary", { cache: "no-store" }).catch(() => EMPTY_SUMMARY),
    serverFetch<{ restaurants: WhatsappRollupRow[] }>("/api/admin/whatsapp/restaurants", { cache: "no-store" }).catch(() => ({ restaurants: [] })),
  ]);

  const statCards = [
    { key: "enabled", label: "Restaurants enabled", value: summary.restaurantsEnabled, icon: Store },
    { key: "messages", label: "Messages this month", value: summary.messagesThisMonth.toLocaleString(), icon: MessageCircle },
    { key: "revenue", label: "Revenue this month", value: `₹${summary.revenueThisMonth.toLocaleString()}`, icon: IndianRupee },
  ];

  return (
    <PageShell
      icon={MessageCircle}
      title="WhatsApp Billing"
      description="Per-message charges for order-completion receipts, across every restaurant."
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {statCards.map(({ key, label, value, icon: Icon }) => (
            <Card key={key} className="border-border/80">
              <CardContent className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-ink">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tracking-tight">{value}</p>
                  <p className="text-sm font-medium">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <WhatsappPlatformTable restaurants={rollup.restaurants} />
      </div>
    </PageShell>
  );
}
