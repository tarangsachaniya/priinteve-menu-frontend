import type { Metadata } from "next";

import { API_INTERNAL_URL } from "@/lib/api/config";
import { apiRequest } from "@/lib/api/http";
import { ClosedNotice } from "@/components/order/closed-notice";
import { MenuBrowser } from "@/components/order/menu-browser";
import { RestoPage } from "@/components/order/resto-page";
import type { PublicMenuCategory, PublicRestaurant } from "@/components/order/types";

export const dynamic = "force-dynamic";

type PublicMenu = { restaurant: PublicRestaurant; categories: PublicMenuCategory[]; recommendedItemIds: string[] };
type TableMenuResponse = { menu: PublicMenu | null; table: { code: string; label: string } | null };

async function loadTableMenu(slug: string, tableCode: string): Promise<TableMenuResponse> {
  const result = await apiRequest<TableMenuResponse>(API_INTERNAL_URL, `/api/order/menu/${slug}/table/${tableCode}`, {
    cache: "no-store",
    allow404: true,
  });
  return result ?? { menu: null, table: null };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { menu } = await loadTableMenu(params.slug, "");
  if (!menu) return { title: "Restaurant not found" };

  const title = menu.restaurant.branch ? `${menu.restaurant.name} — ${menu.restaurant.branch}` : menu.restaurant.name;
  return { title: `${title} · Order online`, description: `Browse the menu and order from ${title}.` };
}

/**
 * What a table's QR code opens. The tableCode is random and unguessable, so
 * scanning one table's code can't be edited into another's. The "table must
 * belong to this slug and be active" check happens on the API, inside the
 * same GET /api/order/menu/:slug/table/:tableCode call that loads the menu —
 * folded into one request rather than the two separate lookups the monolith
 * ran (loadPublicMenu + a direct restaurantTable.findFirst).
 */
export default async function TableOrderPage({
  params,
}: {
  params: { slug: string; tableCode: string };
}) {
  const { menu, table } = await loadTableMenu(params.slug, params.tableCode);

  if (!menu) {
    return (
      <ClosedNotice
        title="Restaurant unavailable"
        message="This restaurant isn't accepting orders right now. Please check the link or try again later."
      />
    );
  }

  if (!table) {
    return (
      <ClosedNotice
        title="Table not found"
        message="This QR code isn't linked to an active table. Please ask a staff member for help."
      />
    );
  }

  return (
    <RestoPage slug={menu.restaurant.slug} brandColor={menu.restaurant.brandColor} themeMode={menu.restaurant.themeMode}>
      <MenuBrowser restaurant={menu.restaurant} table={table} categories={menu.categories} recommendedItemIds={menu.recommendedItemIds} />
    </RestoPage>
  );
}
