import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicMenu, restaurantDescription, restaurantTitle } from "@/lib/order/menu-cache";
import { ClosedNotice } from "@/components/order/closed-notice";
import { MenuBrowser } from "@/components/order/menu-browser";
import { RestoPage } from "@/components/order/resto-page";

/**
 * Table-less entry point, for take-away and delivery. Dine-in is filtered out
 * downstream because there's no table to serve.
 *
 * This is the URL that should rank: it is the restaurant's menu page, the one
 * every table URL points a canonical at.
 */

/**
 * Rendered per request, over cached data. Those are separate settings and the
 * distinction is the whole performance story here.
 *
 * The DATA is cached (see lib/order/menu-cache.ts), so a scan costs no
 * database work. The RENDER is not, because the Open/Closed badge is resolved
 * during it — full-route ISR would freeze that badge for the length of the
 * revalidate window and hand a guest "Open until 11:00 pm" at ten past
 * midnight. An explicit `next.revalidate` on a fetch survives force-dynamic;
 * only fetches that say nothing about caching are downgraded by it.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  // Same request the page component makes — React's cache() collapses the two.
  const data = await getPublicMenu(params.slug);
  if (!data) return { title: "Restaurant not found" };

  const { restaurant } = data;
  const title = `${restaurantTitle(restaurant)} · Menu & Online Ordering`;
  const description = restaurantDescription(restaurant);

  return {
    title,
    description,
    alternates: { canonical: `/order/${restaurant.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/order/${restaurant.slug}`,
      siteName: restaurantTitle(restaurant),
      images: restaurant.coverImageUrl ?? restaurant.logoUrl ?? undefined,
    },
    twitter: {
      card: restaurant.coverImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: restaurant.coverImageUrl ?? restaurant.logoUrl ?? undefined,
    },
  };
}

export default async function RestaurantOrderPage({ params }: { params: { slug: string } }) {
  const data = await getPublicMenu(params.slug);

  // An unknown or deactivated slug is a dead URL, not a page that renders a
  // notice with a 200.
  if (!data) notFound();

  const takeawayOrDelivery = data.restaurant.orderTypes.filter((type) => type !== "DINE_IN");

  // This one IS a real page — the restaurant exists and simply takes orders at
  // the table — so it keeps its 200 and its notice.
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
