"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Clock,
  CreditCard,
  Monitor,
  ReceiptText,
  Store,
  Volume2,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/r/settings/profile", label: "Profile", icon: Store },
  { href: "/r/settings/ordering", label: "Ordering", icon: Banknote },
  { href: "/r/settings/payments", label: "Payments", icon: CreditCard },
  { href: "/r/settings/sounds", label: "Sounds", icon: Volume2 },
  { href: "/r/settings/screens", label: "Screens", icon: Monitor },
  { href: "/r/settings/hours", label: "Hours", icon: Clock },
  { href: "/r/settings/invoice", label: "Invoice", icon: ReceiptText },
];

/**
 * The settings section switcher — a horizontal tab bar, one real route per
 * tab rather than client-side panel state.
 *
 * Styled after the pill-tab row RevenueChart's period switcher already uses
 * on the dashboard (app/(restaurant)/r/dashboard/page.tsx) — a rounded-full
 * `bg-muted` track with the active item lifted onto `bg-card shadow-sm` —
 * rather than the base-ui `Tabs` primitive in components/ui/tabs.tsx. That
 * primitive owns its own panel-switching state via `value`/`onValueChange`,
 * built for content that lives in one mounted tree; each of these seven
 * sections is its own page with its own data fetch, so navigation is real
 * `<Link>`s and only the visual language is "tabs".
 *
 * Deliberately plain conditional classes rather than framer-motion's shared
 * `layoutId` pill: that pill previously had to be kept in its own
 * `layoutId` namespace to avoid colliding with RestaurantSidebar's — simpler
 * to have no shared-layout animation here at all than to keep re-deriving
 * that isolation correctly.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="flex w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
    >
      {SETTINGS_SECTIONS.map((section) => {
        const isActive = pathname === section.href;
        const Icon = section.icon;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-card text-ink shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
