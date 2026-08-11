import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import { getRestaurantOrderUrl } from "@/lib/restaurant/qr-url";
import { PageHeader } from "@/components/shared/page-header";
import { TablesManager } from "@/components/restaurant/tables-manager";

export const dynamic = "force-dynamic";

type TableRow = { id: string; label: string; code: string; seats: number | null; isActive: boolean };

export default async function RestaurantTablesPage() {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  const { restaurant } = sessionData;
  const { tables } = await serverFetch<{ tables: TableRow[] }>("/api/restaurant/tables", { cache: "no-store" });

  // getRestaurantOrderUrl already resolves the deployment origin; strip the
  // path so the client can build per-table links without duplicating it.
  const baseUrl = getRestaurantOrderUrl(restaurant.slug).replace(`/order/${restaurant.slug}`, "");

  return (
    <main className="mx-auto max-w-6xl p-6 sm:p-8 lg:p-10">
      <PageHeader
        icon={QrCode}
        title="Tables & QR"
        description="Every table gets a unique QR code that opens your menu."
      />

      <TablesManager
        initialTables={tables}
        restaurantSlug={restaurant.slug}
        baseUrl={baseUrl}
        offersTakeaway={restaurant.takeAwayEnabled || restaurant.deliveryEnabled}
      />
    </main>
  );
}
