import { notFound } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

import { serverFetch } from "@/lib/api/server";
import { getRestaurantOrderUrl } from "@/lib/restaurant/qr-url";
import { PageHeader } from "@/components/shared/page-header";
import { RestaurantDetailPanel } from "@/components/restaurant/admin/restaurant-detail-panel";
import { AudioSettingsForm, type AudioSettings } from "@/components/restaurant/audio-settings-form";
import { PaymentSettingsForm, type PaymentSettings } from "@/components/restaurant/payment-settings-form";
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
  _count: { tables: number; menuItems: number; categories: number; orders: number };
};

type AdminTablesDTO = {
  restaurant: { offersTakeaway: boolean; orderUrl: string };
  tables: AdminTableRow[];
};

export default async function AdminRestaurantDetailPage({ params }: { params: { id: string } }) {
  // Independent reads, so the page costs one round trip rather than four.
  // Payment and audio tolerate failure — a still-deploying API missing either
  // route should not take the whole provisioning screen down with it.
  const [data, tableData, payment, audio] = await Promise.all([
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
  ]);

  if (!data) {
    notFound();
  }

  const { restaurant } = data;
  const owner = restaurant.users.find((u) => u.role === "OWNER");

  return (
    <main className="mx-auto max-w-6xl p-6 sm:p-8 lg:p-10">
      <PageHeader
        icon={UtensilsCrossed}
        title={restaurant.branch ? `${restaurant.name} — ${restaurant.branch}` : restaurant.name}
        description={`${restaurant._count.menuItems} menu items · ${restaurant._count.tables} tables · ${restaurant._count.orders} orders`}
      />

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

      <div className="mt-6">
        <QrMenuCardsPanel
          restaurantId={restaurant.id}
          offersTakeaway={tableData?.restaurant.offersTakeaway ?? false}
          orderUrl={tableData?.restaurant.orderUrl ?? getRestaurantOrderUrl(restaurant.slug)}
          tables={tableData?.tables ?? []}
        />
      </div>
    </main>
  );
}
