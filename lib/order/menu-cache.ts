import { cache } from "react";

import { API_INTERNAL_URL } from "@/lib/api/config";
import { apiRequest } from "@/lib/api/http";
import { resolveAvailability } from "@/lib/restaurant/hours";
import { resolvePeakState } from "@/lib/restaurant/peak-hours";
import type { PublicMenuCategory, PublicRestaurant, PublicTable } from "@/components/order/types";

/**
 * How a QR scan gets from a cold URL to a rendered menu.
 *
 * The whole page used to be `cache: "no-store"` behind `force-dynamic`, so
 * every scan of every table ran the full restaurant read — menu, categories,
 * dishes, variants, add-ons, reviews, hours — before a single byte reached the
 * guest. On a phone on restaurant wifi that is the difference between a menu
 * that feels instant and one people assume is broken.
 *
 * Two caches, split by how the data behaves rather than by where it lives:
 *
 *   1. THE MENU (getPublicMenu) — one entry per restaurant, shared by every
 *      table, revalidated on a timer AND dropped by tag the moment the owner
 *      edits anything. Big, read constantly, changes a few times a week.
 *
 *   2. THE TABLE (getTable) — never cached. It is one indexed lookup and it
 *      decides whether this specific QR sticker still works, which has to be
 *      true right now, not true five minutes ago.
 *
 * On top of both, React's cache() dedupes within a single render pass, which
 * is what stops generateMetadata() and the page component from each issuing
 * their own copy of the same request. That alone halved the request count on
 * every menu route.
 *
 * WHAT IS DELIBERATELY NOT CACHED: whether the restaurant is open. That is
 * derived below, per request, from cached inputs — see withLiveState().
 */

export type PublicMenu = {
  restaurant: PublicRestaurant;
  categories: PublicMenuCategory[];
  recommendedItemIds: string[];
};

/**
 * The tag the API drops when a restaurant edits its menu.
 *
 * MUST match menuTag() in priinteve-api/src/services/revalidate.ts. A mismatch
 * compiles, deploys, and shows up weeks later as a menu that never updates.
 */
export const menuTag = (slug: string) => `menu:${slug}`;

/**
 * Backstop for a dropped invalidation, not the primary mechanism.
 *
 * The API posts a revalidateTag() the instant anything changes, so this window
 * only matters when that call is lost — the frontend restarting mid-request,
 * say. Five minutes is short enough that nobody stares at a stale price and
 * long enough that a busy restaurant still serves most scans from cache.
 */
const MENU_REVALIDATE_SECONDS = 300;

/**
 * One restaurant's entire guest payload.
 *
 * Returns null for an unknown or deactivated slug — callers turn that into
 * notFound(), which is what a crawler and a mistyped URL both need.
 */
export const getPublicMenu = cache(async (slug: string): Promise<PublicMenu | null> => {
  const data = await apiRequest<PublicMenu>(API_INTERNAL_URL, `/api/order/menu/${encodeURIComponent(slug)}`, {
    next: { revalidate: MENU_REVALIDATE_SECONDS, tags: [menuTag(slug)] },
    allow404: true,
  });

  return data ? withLiveState(data) : null;
});

/**
 * Is this QR sticker still live, and what is the table called?
 *
 * Uncached on purpose: a table retired at 8pm has to stop taking orders at
 * 8pm. See the note at the top of this file.
 */
export const getTable = cache(async (slug: string, tableCode: string): Promise<PublicTable | null> => {
  const data = await apiRequest<{ table: PublicTable | null }>(
    API_INTERNAL_URL,
    `/api/order/menu/${encodeURIComponent(slug)}/table/${encodeURIComponent(tableCode)}/only`,
    { cache: "no-store", allow404: true },
  );

  return data?.table ?? null;
});

/**
 * Re-derives everything time-dependent over a payload that may have come from
 * cache.
 *
 * This is the piece that lets the menu be cached at all. `openState` and
 * `peakState` arrive from the API resolved against the clock at cache-write
 * time; a menu cached at 22:55 would still claim "Open until 11:00 pm" at
 * midnight. So they are thrown away and recomputed here from the raw inputs
 * that rode along with them — the weekly hours, the timezone, the manual
 * pause — using the SAME resolver the API and the place-order route use.
 *
 * Note what this means for correctness: the state is evaluated in the
 * restaurant's own zone (Asia/Kolkata for every current tenant), on the
 * server, per request. Neither the visitor's clock nor the host's local
 * timezone is consulted anywhere in the chain.
 */
function withLiveState(data: PublicMenu): PublicMenu {
  const { restaurant } = data;

  return {
    ...data,
    restaurant: {
      ...restaurant,
      openState: resolveAvailability(restaurant),
      peakState: resolvePeakState({
        windows: restaurant.peakWindows,
        timezone: restaurant.timezone,
      }),
    },
  };
}

/**
 * Title and description for a restaurant's guest pages.
 *
 * One helper for both routes so a table URL and the table-less URL cannot
 * describe the same restaurant differently.
 */
export function restaurantTitle(restaurant: PublicRestaurant): string {
  return restaurant.branch ? `${restaurant.name} — ${restaurant.branch}` : restaurant.name;
}

/**
 * The meta description, built from whatever the owner actually filled in.
 *
 * Prefers their own words, falls back to the cuisine tags, and only then to
 * generic wording — a search result reading "Browse the menu and order from X"
 * for every restaurant on the platform is a wasted 160 characters.
 */
export function restaurantDescription(restaurant: PublicRestaurant): string {
  const title = restaurantTitle(restaurant);
  const own = restaurant.description?.trim() || restaurant.tagline?.trim();
  if (own) return own.length > 300 ? `${own.slice(0, 297)}…` : own;

  const cuisines = restaurant.cuisineTags.length > 0 ? `${restaurant.cuisineTags.join(", ")} · ` : "";
  const where = restaurant.address?.trim() ? ` in ${restaurant.address.trim()}` : "";
  return `${cuisines}View the full menu and order online from ${title}${where}. Scan, browse and order from your table.`;
}
