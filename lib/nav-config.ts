import { UtensilsCrossed, type LucideIcon } from "lucide-react";

import { RESTAURANT_NAV_ITEMS } from "@/lib/restaurant/nav-config";

/**
 * Generic breadcrumb-label lookup, mirroring Cards' lib/nav-config.ts shape
 * (components/shared/breadcrumbs.tsx is a byte-identical copy of that file
 * and imports from this exact path). Combines the restaurant console's own
 * nav items with the platform-admin restaurant-provisioning ones, since both
 * live in this app.
 */
type NavItem = { href: string; label: string; icon: LucideIcon };

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/restaurants", label: "Restaurants", icon: UtensilsCrossed },
];

const ALL_NAV_ITEMS: NavItem[] = [...RESTAURANT_NAV_ITEMS, ...ADMIN_NAV_ITEMS];

/** Longest-prefix match against every known nav href, for breadcrumb labels. */
export function labelForSegmentPath(path: string): string | undefined {
  const match = ALL_NAV_ITEMS.find((item) => item.href === path);
  return match?.label;
}
