import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  IndianRupee,
  LayoutDashboard,
  QrCode,
  ReceiptText,
  TrendingUp,
} from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import { getRestaurantOrderUrl } from "@/lib/restaurant/qr-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { RevenueChart, type RevenuePoint } from "@/components/restaurant/revenue-chart";

export const dynamic = "force-dynamic";

type Period = "day" | "month" | "year";

const PERIODS: { key: Period; tab: string; title: string }[] = [
  { key: "day", tab: "Daily", title: "Last 14 days" },
  { key: "month", tab: "Monthly", title: "Last 12 months" },
  { key: "year", tab: "Yearly", title: "Last 5 years" },
];

function parsePeriod(value: string | undefined): Period {
  return value === "month" || value === "year" ? value : "day";
}

type DashboardData = {
  period: Period;
  todayOrderCount: number;
  todayRevenue: number;
  averageOrder: number;
  liveCount: number;
  menuItemCount: number;
  tableCount: number;
  trend: RevenuePoint[];
  periodRevenue: number;
};

export default async function RestaurantDashboardPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  const period = parsePeriod(searchParams.period);
  const data = await serverFetch<DashboardData>(`/api/restaurant/dashboard?period=${period}`, {
    cache: "no-store",
  });

  const { restaurant } = sessionData;
  const activePeriod = PERIODS.find((p) => p.key === period) ?? PERIODS[0];
  const needsSetup = data.menuItemCount === 0 || data.tableCount === 0;

  const stats = [
    {
      key: "orders",
      label: "Orders today",
      value: String(data.todayOrderCount),
      icon: ReceiptText,
      description: `${data.liveCount} in the kitchen now`,
    },
    {
      key: "revenue",
      label: "Revenue today",
      value: formatCurrency(data.todayRevenue),
      icon: IndianRupee,
      description: "Excludes cancelled orders",
    },
    {
      key: "average",
      label: "Average order",
      value: formatCurrency(data.averageOrder),
      icon: TrendingUp,
      description: "Today's average bill",
    },
    {
      key: "setup",
      label: "Menu & tables",
      value: `${data.menuItemCount} · ${data.tableCount}`,
      icon: BookOpen,
      description: "Items and active tables",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6 sm:p-8 lg:p-10">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        description={restaurant.branch ? `${restaurant.name} — ${restaurant.branch}` : restaurant.name}
        action={
          <Button size="sm" render={<Link href="/r/orders" />}>
            <ReceiptText data-icon="inline-start" />
            Open orders board
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {needsSetup && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">Finish setting up</p>
                <p className="text-sm text-muted-foreground">
                  {data.menuItemCount === 0
                    ? "Add your menu so customers have something to order."
                    : "Add your tables to generate QR codes."}
                </p>
              </div>
              <Button size="sm" render={<Link href={data.menuItemCount === 0 ? "/r/menu" : "/r/tables"} />}>
                {data.menuItemCount === 0 ? "Build the menu" : "Add tables"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ key, label, value, icon: Icon, description }) => (
            <Card key={key} className="border-border/80">
              <CardContent className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-ink">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tracking-tight">{value}</p>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border/80">
          <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-row">
            <div>
              <CardTitle className="text-base">Earnings · {formatCurrency(data.periodRevenue)}</CardTitle>
              <CardDescription>{activePeriod.title} — orders that weren&apos;t cancelled.</CardDescription>
            </div>

            {/* Links rather than buttons: the page is a server component, so
                switching period is a navigation and stays shareable. */}
            <nav aria-label="Earnings period" className="flex gap-1 rounded-full bg-muted p-1">
              {PERIODS.map(({ key, tab }) => (
                <Link
                  key={key}
                  href={`/r/dashboard?period=${key}`}
                  aria-current={key === period ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    key === period ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </Link>
              ))}
            </nav>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.trend} />
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4" />
              Your ordering link
            </CardTitle>
            <CardDescription>
              Share this for take-away and delivery. Dine-in guests scan their table&apos;s own QR code.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <a
              href={getRestaurantOrderUrl(restaurant.slug)}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm underline-offset-4 hover:underline"
            >
              {getRestaurantOrderUrl(restaurant.slug)}
            </a>
            <Button variant="outline" size="sm" render={<Link href="/r/tables" />}>
              Manage table QR codes
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
