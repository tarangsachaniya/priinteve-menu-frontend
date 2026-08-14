import { serverFetch } from "@/lib/api/server";

/**
 * Server-side helpers for the two mounted screens.
 *
 * These go through serverFetch, which forwards the incoming Cookie header —
 * and the cookie that matters here is pv_screen, since it is what decides
 * whether the page renders a keypad or a board.
 *
 * What they must never do is require a staff session: /kds/<token> and
 * /display/<token> are opened on devices that have never logged in, which is
 * the entire point of the token-and-PIN pair. See the API's
 * auth/screen-session.ts.
 */

export type ScreenKind = "KITCHEN" | "PICKUP";

export type ScreenProbe = {
  restaurantName: string;
  branch: string | null;
  kind: ScreenKind;
  unlocked: boolean;
  /** False when a link exists but the owner never chose a PIN. */
  pinSet: boolean;
};

/** Resolves a link segment. Null for an unknown, rotated or disabled link. */
export function probeScreen(token: string): Promise<ScreenProbe | null> {
  return serverFetch<ScreenProbe | null>(`/api/screen/${encodeURIComponent(token)}`, {
    cache: "no-store",
    allow404: true,
  });
}

/** Fetches a screen's own data endpoint with the screen session attached. */
export function screenFetch<T>(token: string, suffix: string): Promise<T> {
  return serverFetch<T>(`/api/screen/${encodeURIComponent(token)}${suffix}`, { cache: "no-store" });
}

// The path builders live in screen-paths.ts, which is client-safe. Importing
// them from here would drag next/headers into every screen's browser bundle.
