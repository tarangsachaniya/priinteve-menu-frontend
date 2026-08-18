"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
 * The section rail for the settings layout — vertical on md+, a horizontal
 * scroller on mobile where there's no room for a second sidebar.
 *
 * NOT NavItemLink (components/dashboard/nav-item.tsx). That component's active
 * pill uses `layoutId="nav-active-pill"`, and framer-motion resolves a
 * `layoutId` against every mounted element sharing it — reusing it here would
 * put this rail's pill and RestaurantSidebar's pill in the same shared-layout
 * group, so navigating between settings sections would animate the sidebar's
 * pill flying in from wherever "Settings" sits in the main nav. A distinct
 * `layoutId` is what keeps the two animations independent.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto pb-2 md:w-52 md:shrink-0 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0"
    >
      {SETTINGS_SECTIONS.map((section) => {
        const isActive = pathname === section.href;
        const Icon = section.icon;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "relative flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors md:shrink",
              isActive ? "text-ink" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="settings-nav-active-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Icon className="relative size-4 shrink-0" />
            <span className="relative">{section.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
