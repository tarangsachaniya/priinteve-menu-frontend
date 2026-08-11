import { UtensilsCrossed, CheckCircle2, CircleSlash, ReceiptText } from "lucide-react";

import { serverFetch } from "@/lib/api/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { RestaurantsTable } from "@/components/restaurant/admin/restaurants-table";
import type { AdminRestaurant } from "@/components/restaurant/admin/restaurant-form";

export const dynamic = "force-dynamic";

type RestaurantsResponse = {
  restaurants: AdminRestaurant[];
  stats: { total: number; active: number; inactive: number; orders: number };
};

export default async function AdminRestaurantsPage() {
  const { restaurants, stats } = await serverFetch<RestaurantsResponse>("/api/admin/restaurants", {
    cache: "no-store",
  });

  const statCards = [
    { key: "total", label: "Restaurants", value: stats.total, icon: UtensilsCrossed, description: "All restaurants" },
    { key: "active", label: "Live", value: stats.active, icon: CheckCircle2, description: "Accepting orders" },
    { key: "paused", label: "Paused", value: stats.inactive, icon: CircleSlash, description: "Hidden from customers" },
    { key: "orders", label: "Total orders", value: stats.orders, icon: ReceiptText, description: "Across all restaurants" },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6 sm:p-8 lg:p-10">
      <PageHeader
        icon={UtensilsCrossed}
        title="Restaurants"
        description="Create restaurants and manage their ordering accounts."
      />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map(({ key, label, value, icon: Icon, description }) => (
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

        <RestaurantsTable initialRestaurants={restaurants} />
      </div>
    </main>
  );
}
