import { Settings } from "lucide-react";

import { PageShell } from "@/components/shared/page-shell";

/**
 * Shell for every settings sub-route (profile, ordering, payments, sounds,
 * screens, hours, invoice).
 *
 * Used to be one page: a single server component that fetched three
 * endpoints in parallel before rendering anything, stacking eight sections
 * under one very long scroll with one Save button at the bottom. Splitting it
 * into routes means each section fetches only what it shows and saves only
 * what it edited — see components/restaurant/settings/shared.tsx's
 * patchRestaurantSettings for the partial-PATCH half of that.
 *
 * No section switcher rendered here any more — a horizontal tab row for
 * seven labels clipped its last item and needed its own scrollbar at
 * ordinary desktop widths. The switcher now lives in RestaurantSidebar
 * itself, nested under the Settings link (see SettingsSubNav there and
 * SETTINGS_NAV_ITEMS in lib/restaurant/nav-config.ts), which has a whole
 * vertical column to grow into and no width limit to fight.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      width="reading"
      icon={Settings}
      title="Settings"
      description="Order types, payment options and how your restaurant appears to customers."
    >
      {children}
    </PageShell>
  );
}
