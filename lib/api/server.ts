import { cookies } from "next/headers";

import { API_INTERNAL_URL } from "@/lib/api/config";
import { apiRequest, type FetchOptions } from "@/lib/api/http";
import type { RestoKotPrinterMode, RestoOperationType } from "@/lib/api/enums";

/**
 * Server components call the API DIRECTLY (never through this app's own
 * proxy) and forward the incoming request's Cookie header so the API can
 * read the restaurant-staff / platform-admin session.
 */
function forwardedCookieHeader(): string {
  return cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export function serverFetch<T>(path: string, opts: Omit<FetchOptions, "cookie"> = {}): Promise<T> {
  return apiRequest<T>(API_INTERNAL_URL, path, { ...opts, cookie: forwardedCookieHeader() });
}

export type RestaurantSession = {
  userId: string;
  restaurantId: string;
  email: string;
  name: string;
  role: "OWNER" | "STAFF";
};

export type RestaurantInfo = {
  name: string;
  branch: string | null;
  slug: string;
  isActive: boolean;
  takeAwayEnabled: boolean;
  deliveryEnabled: boolean;
  // Printing architecture + operational modules — see lib/api/enums.ts.
  // operationType is admin-only to view here (never editable from a
  // restaurant session); kitchenEnabled/pickupEnabled/tvEnabled gate the
  // Kitchen board, Pickup board and TV pairing respectively.
  operationType: RestoOperationType;
  kotPrinterMode: RestoKotPrinterMode | null;
  kitchenEnabled: boolean;
  pickupEnabled: boolean;
  tvEnabled: boolean;
};

/** Fresh from the API on every call — a paused restaurant loses access immediately. */
export async function getRestaurantSession(): Promise<{
  session: RestaurantSession;
  restaurant: RestaurantInfo;
} | null> {
  try {
    return await serverFetch("/api/restaurant/session", { cache: "no-store" });
  } catch {
    return null;
  }
}

export type AdminSessionUser = {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
};

/** Platform-admin session (same realm as Cards) for the restaurant-provisioning admin pages. */
export async function getAdminSession(): Promise<{ user: AdminSessionUser } | null> {
  const { user } = await serverFetch<{ user: AdminSessionUser | null }>("/api/auth/session", {
    cache: "no-store",
  });
  return user ? { user } : null;
}
