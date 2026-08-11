import { notFound } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

import { serverFetch } from "@/lib/api/server";
import { getRestaurantOrderUrl } from "@/lib/restaurant/qr-url";
import { PageHeader } from "@/components/shared/page-header";
import { RestaurantDetailPanel } from "@/components/restaurant/admin/restaurant-detail-panel";

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

export default async function AdminRestaurantDetailPage({ params }: { params: { id: string } }) {
  const data = await serverFetch<{ restaurant: RestaurantDetailDTO }>(
    `/api/admin/restaurants/${params.id}`,
    { cache: "no-store", allow404: true },
  );

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
    </main>
  );
}
