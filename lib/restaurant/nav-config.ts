import {
  Banknote,
  LayoutDashboard,
  BookOpen,
  ChefHat,
  Clock,
  CreditCard,
  History,
  Monitor,
  Printer,
  ReceiptText,
  Settings,
  Star,
  Store,
  Table2,
  Tv,
  Volume2,
  type LucideIcon,
} from "lucide-react";

export type RestaurantNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const RESTAURANT_NAV_ITEMS: RestaurantNavItem[] = [
  { href: "/r/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/r/orders", label: "Orders", icon: ReceiptText },
  // A sibling of /r/orders, not a child: the sidebar marks an item active with
  // startsWith(`${href}/`), so /r/orders/history would light up both entries.
  // The same rule is why the kitchen display below is /r/kitchen.
  { href: "/r/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/r/history", label: "History", icon: History },
  { href: "/r/menu", label: "Menu", icon: BookOpen },
  // "Tables", not "Tables & QR": the QR half moved to the admin side when
  // printing became a Priinteve Innovations-operated step.
  { href: "/r/tables", label: "Tables", icon: Table2 },
  { href: "/r/reviews", label: "Reviews", icon: Star },
  { href: "/r/settings", label: "Settings", icon: Settings },
];

/**
 * The seven settings sections, nested under the Settings item in the
 * sidebar itself rather than a separate tab bar in the content area.
 *
 * A horizontal tab row here used to clip its last item and scroll under its
 * own weight at ordinary desktop widths — seven labels plus icons simply
 * don't fit above ~1100px, and a scrollbar on a primary nav reads as broken
 * rather than as "more items available". The sidebar has no such limit: it's
 * a vertical list with room to grow, and it's already sitting right next to
 * the content with nothing else competing for that space once "Settings" is
 * the active section.
 */
export const SETTINGS_NAV_ITEMS: RestaurantNavItem[] = [
  { href: "/r/settings/profile", label: "Profile", icon: Store },
  { href: "/r/settings/ordering", label: "Ordering", icon: Banknote },
  { href: "/r/settings/payments", label: "Payments", icon: CreditCard },
  { href: "/r/settings/sounds", label: "Sounds", icon: Volume2 },
  { href: "/r/settings/screens", label: "Screens", icon: Monitor },
  { href: "/r/settings/devices", label: "Devices", icon: Tv },
  { href: "/r/settings/printing", label: "Printing", icon: Printer },
  { href: "/r/settings/hours", label: "Hours", icon: Clock },
  { href: "/r/settings/invoice", label: "Invoice", icon: ReceiptText },
];
