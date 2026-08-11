import type { Metadata } from "next";

import { API_INTERNAL_URL } from "@/lib/api/config";
import { apiRequest } from "@/lib/api/http";
import { ClosedNotice } from "@/components/order/closed-notice";
import { MenuBrowser } from "@/components/order/menu-browser";
import { RestoPage } from "@/components/order/resto-page";
import type { PublicMenuCategory, PublicRestaurant } from "@/components/order/types";

export const dynamic = "force-dynamic";

type PublicMenu = { restaurant: PublicRestaurant; categories: PublicMenuCategory[]; recommendedItemIds: string[] };

async function loadPublicMenu(slug: string): Promise<PublicMenu | null> {
  return apiRequest<PublicMenu>(API_INTERNAL_URL, `/api/order/menu/${slug}`, { cache: "no-store", allow404: true });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await loadPublicMenu(params.slug);
  if (!data) return { title: "Restaurant not found" };

  const title = data.restaurant.branch ? `${data.restaurant.name} — ${data.restaurant.branch}` : data.restaurant.name;
  return { title: `${title} · Order online`, description: `Browse the menu and order from ${title}.` };
}

/**
 * Table-less entry point, for take-away and delivery. Dine-in is filtered out
 * downstream because there's no table to serve.
 */
export default async function RestaurantOrderPage({ params }: { params: { slug: string } }) {
  const data = await loadPublicMenu(params.slug);

  if (!data) {
    return (
      <ClosedNotice
        title="Restaurant unavailable"
        message="This restaurant isn't accepting orders right now. Please check the link or try again later."
      />
    );
  }

  const takeawayOrDelivery = data.restaurant.orderTypes.filter((type) => type !== "DINE_IN");
  if (takeawayOrDelivery.length === 0) {
    return (
      <ClosedNotice
        title="Dine-in only"
        message={`${data.restaurant.name} takes orders from a table. Please scan the QR code on your table to order.`}
      />
    );
  }

  return (
    <RestoPage slug={data.restaurant.slug} brandColor={data.restaurant.brandColor} themeMode={data.restaurant.themeMode}>
      <MenuBrowser
        restaurant={{ ...data.restaurant, orderTypes: takeawayOrDelivery }}
        table={null}
        categories={data.categories}
        recommendedItemIds={data.recommendedItemIds}
      />
    </RestoPage>
  );
}
