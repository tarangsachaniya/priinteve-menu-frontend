/**
 * Light/dark and accent handling for the restaurant template.
 *
 * Deliberately separate from lib/restaurant/brand.ts: that module is colour
 * maths, this one is which palette a given visitor sees. Mirrors
 * lib/card-theme.ts, which solves the same problem for the card product.
 *
 * The restaurant owner picks a default (stored on Restaurant.themeMode) and a
 * visitor can always override it with the on-page toggle. The override is
 * remembered in localStorage, keyed per restaurant.
 */

export const RESTO_MODES = ["light", "dark", "system"] as const;
export type RestoMode = (typeof RESTO_MODES)[number];

/** Zod-friendly tuple, matching how the card product consumes its equivalent. */
export const RESTO_MODE_IDS = RESTO_MODES as unknown as [string, ...string[]];

/** What actually gets painted, once `system` has been resolved. */
export type ResolvedRestoMode = "light" | "dark";

/** The design is dark-first; a new restaurant matches it without configuring anything. */
export const DEFAULT_RESTO_MODE: RestoMode = "dark";

export const RESTO_MODE_OPTIONS: { id: RestoMode; label: string; description: string }[] = [
  { id: "dark", label: "Dark", description: "Warm near-black. Always dark for every guest." },
  { id: "light", label: "Light", description: "Clean white. Always light for every guest." },
  { id: "system", label: "System", description: "Follows each guest's device setting." },
];

export function isRestoMode(value: string | null | undefined): value is RestoMode {
  return typeof value === "string" && (RESTO_MODES as readonly string[]).includes(value);
}

export function normalizeRestoMode(value: string | null | undefined): RestoMode {
  return isRestoMode(value) ? value : DEFAULT_RESTO_MODE;
}

/**
 * Per-restaurant key, so a guest who prefers light at one restaurant does not
 * force light onto every other restaurant they scan into.
 */
export function restoModeStorageKey(slug: string): string {
  return `printeve-resto-mode:${slug}`;
}

/**
 * Server-side resolution. `system` cannot be resolved on the server — there is
 * no visitor yet — so it renders dark and the pre-paint script corrects it
 * before anything is shown.
 */
export function resolveRestoModeForRender(mode: RestoMode): ResolvedRestoMode {
  return mode === "light" ? "light" : "dark";
}
