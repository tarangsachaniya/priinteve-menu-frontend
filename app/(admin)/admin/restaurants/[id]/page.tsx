import { notFound } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

import { serverFetch } from "@/lib/api/server";
import type { RestoKotPrinterMode, RestoOperationType } from "@/lib/api/enums";
import { getRestaurantOrderUrl } from "@/lib/restaurant/qr-url";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { RestaurantDetailPanel } from "@/components/restaurant/admin/restaurant-detail-panel";
import { AudioSettingsForm, type AudioSettings } from "@/components/restaurant/audio-settings-form";
import { PaymentSettingsForm, type PaymentSettings } from "@/components/restaurant/payment-settings-form";
import { LoyaltySettingsForm, type LoyaltySettings } from "@/components/restaurant/loyalty-settings-form";
import {
  QrMenuCardsPanel,
  type AdminTableRow,
} from "@/components/restaurant/admin/qr-menu-cards-panel";

export const dynamic = "force-dynamic";

type RestaurantUser = { email: string; name: string; role: string };

type RestaurantDetailDTO = {
  id: string;
  name: string;
  branch: string | null;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  users: RestaurantUser[];
  operationType: RestoOperationType;
  kotPrinterMode: RestoKotPrinterMode | null;
  kitchenEnabled: boolean;
  pickupEnabled: boolean;
  tvEnabled: boolean;
  _count: { tables: number; menuItems: number; categories: number; orders: number };
};

type AdminTablesDTO = {
  restaurant: { offersTakeaway: boolean; orderUrl: string };
  tables: AdminTableRow[];
};

type ScratchProgramDTO = { isEnabled: boolean; campaigns: { id: string; name: string; status: string }[] };

export default async function AdminRestaurantDetailPage({ params }: { params: { id: string } }) {
  // Independent reads, so the page costs one round trip rather than four.
  // Payment and audio tolerate failure — a still-deploying API missing either
  // route should not take the whole provisioning screen down with it.
  const [data, tableData, payment, audio, loyalty, scratchProgram] = await Promise.all([
    serverFetch<{ restaurant: RestaurantDetailDTO }>(`/api/admin/restaurants/${params.id}`, {
      cache: "no-store",
      allow404: true,
    }),
    serverFetch<AdminTablesDTO>(`/api/admin/restaurants/${params.id}/tables`, {
      cache: "no-store",
      allow404: true,
    }),
    serverFetch<PaymentSettings>(`/api/admin/restaurants/${params.id}/payment`, {
      cache: "no-store",
    }).catch(() => null),
    serverFetch<AudioSettings>(`/api/admin/restaurants/${params.id}/audio`, {
      cache: "no-store",
    }).catch(() => null),
    serverFetch<LoyaltySettings>(`/api/admin/restaurants/${params.id}/loyalty`, {
      cache: "no-store",
    }).catch(() => null),
    serverFetch<ScratchProgramDTO>(`/api/admin/restaurants/${params.id}/scratch`, {
      cache: "no-store",
    }).catch(() => null),
  ]);

  if (!data) {
    notFound();
  }

  const { restaurant } = data;
  const owner = restaurant.users.find((u) => u.role === "OWNER");

  return (
    <PageShell
      icon={UtensilsCrossed}
      title={restaurant.branch ? `${restaurant.name} — ${restaurant.branch}` : restaurant.name}
      description={`${restaurant._count.menuItems} menu items · ${restaurant._count.tables} tables · ${restaurant._count.orders} orders`}
    >
      <RestaurantDetailPanel
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          branch: restaurant.branch,
          slug: restaurant.slug,
          phone: restaurant.phone,
          email: restaurant.email,
          address: restaurant.address,
          isActive: restaurant.isActive,
          ownerEmail: owner?.email ?? null,
          ownerName: owner?.name ?? null,
          orderUrl: getRestaurantOrderUrl(restaurant.slug),
          operationType: restaurant.operationType,
          kotPrinterMode: restaurant.kotPrinterMode,
          kitchenEnabled: restaurant.kitchenEnabled,
          pickupEnabled: restaurant.pickupEnabled,
          tvEnabled: restaurant.tvEnabled,
          loyaltyEnabled: loyalty?.loyaltyEnabled ?? false,
          scratchEnabled: scratchProgram?.isEnabled ?? false,
        }}
      />

      {/* The same two components the restaurant sees in its own console, not
          admin-only copies — so there is exactly one definition of which fields
          are secret and how an omitted secret is treated. Support can help an
          owner who is stuck on their Razorpay keys without either screen
          drifting from the other. */}
      {payment && (
        <div className="mt-6">
          <PaymentSettingsForm
            endpoint={`/api/admin/restaurants/${restaurant.id}/payment`}
            initial={payment}
          />
        </div>
      )}

      {audio && (
        <div className="mt-6">
          <AudioSettingsForm
            endpoint={`/api/admin/restaurants/${restaurant.id}/audio`}
            initial={audio}
          />
        </div>
      )}

      {/* Support-override numeric config — the toggle itself lives in the
          panel above. Shown even while loyalty is off: an admin helping a
          restaurant get set up may want to pre-fill rates before flipping
          the switch. */}
      {loyalty && (
        <div className="mt-6">
          <LoyaltySettingsForm
            endpoint={`/api/admin/restaurants/${restaurant.id}/loyalty`}
            initial={loyalty}
          />
        </div>
      )}

      {/* Read-only — campaign design is the restaurant's own job once the
          toggle above is on (see restaurant/scratch.routes.ts's POST
          /campaign). This is oversight, not an editor. */}
      {scratchProgram && scratchProgram.campaigns.length > 0 && (
        <Card className="mt-6 border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Scratch campaigns</CardTitle>
            <CardDescription>Set up by the restaurant itself — view only.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {scratchProgram.campaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between rounded-2xl border border-border/70 p-3 text-sm">
                <span>{campaign.name}</span>
                <Badge variant="secondary">{campaign.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <QrMenuCardsPanel
          restaurantId={restaurant.id}
          offersTakeaway={tableData?.restaurant.offersTakeaway ?? false}
          orderUrl={tableData?.restaurant.orderUrl ?? getRestaurantOrderUrl(restaurant.slug)}
          tables={tableData?.tables ?? []}
        />
      </div>
    </PageShell>
  );
}
