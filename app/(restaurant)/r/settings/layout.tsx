import { Settings } from "lucide-react";

import { PageShell } from "@/components/shared/page-shell";
import { SettingsNav } from "@/components/restaurant/settings/settings-nav";

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
 * The header and the section rail live here, once, rather than being repeated
 * by every sub-page — that repetition is exactly the kind of drift a shared
 * layout exists to prevent.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      width="nav"
      icon={Settings}
      title="Settings"
      description="Order types, payment options and how your restaurant appears to customers."
    >
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageShell>
  );
}
