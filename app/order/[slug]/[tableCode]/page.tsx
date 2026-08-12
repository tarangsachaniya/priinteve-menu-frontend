import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getPublicMenu,
  getTable,
  restaurantDescription,
  restaurantTitle,
} from "@/lib/order/menu-cache";
import { MenuBrowser } from "@/components/order/menu-browser";
import { RestoPage } from "@/components/order/resto-page";

/**
 * What a table's QR code opens.
 *
 * The tableCode is random and unguessable, and the API requires it to belong
 * to this slug and be active, so scanning one table's code cannot be edited
 * into another's.
 *
 * The menu and the table are fetched separately and in parallel: the menu is
 * cached per restaurant and shared by every table, while the table lookup is
 * live because a retired table must stop working immediately. See
 * lib/order/menu-cache.ts.
 */

/** Per-request render over cached data — see the note on the sibling route. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; tableCode: string };
}): Promise<Metadata> {
  /**
   * This used to call the loader with an EMPTY table code — loadTableMenu(slug,
   * "") — which never matched a route, 404'd every time, and gave every single
   * table URL on the platform the title "Restaurant not found". Crawlers and
   * shared links saw that string and nothing else.
   *
   * Only the restaurant is needed here, so only the restaurant is fetched, and
   * React's cache() means the page component below reuses this exact response
   * rather than issuing a second one.
   */
  const data = await getPublicMenu(params.slug);
  if (!data) return { title: "Restaurant not found" };

  const { restaurant } = data;
  const title = `${restaurantTitle(restaurant)} · Menu & Online Ordering`;
  const description = restaurantDescription(restaurant);
  const url = `/order/${restaurant.slug}/${params.tableCode}`;

  return {
    title,
    description,
    // A table URL is scanned, not searched. Indexing one page per table would
    // fill the index with near-duplicates of the restaurant's own menu page,
    // which is the URL that should rank — so point every table at it.
    alternates: { canonical: `/order/${restaurant.slug}` },
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url,
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

export default async function TableOrderPage({
  params,
}: {
  params: { slug: string; tableCode: string };
}) {
  const [data, table] = await Promise.all([
    getPublicMenu(params.slug),
    getTable(params.slug, params.tableCode),
  ]);

  // A slug nobody owns is genuinely not a page. Rendering a friendly notice
  // with a 200 told crawlers this URL exists, and told a guest who mistyped
  // the link the same thing it tells one whose restaurant was deactivated.
  if (!data) notFound();

  // A code that isn't an active table of this restaurant is likewise a dead
  // URL, not a temporarily unavailable one.
  if (!table) notFound();

  const { restaurant, categories, recommendedItemIds } = data;

  return (
    <RestoPage slug={restaurant.slug} brandColor={restaurant.brandColor} themeMode={restaurant.themeMode}>
      <MenuBrowser
        restaurant={restaurant}
        table={table}
        categories={categories}
        recommendedItemIds={recommendedItemIds}
      />
    </RestoPage>
  );
}
