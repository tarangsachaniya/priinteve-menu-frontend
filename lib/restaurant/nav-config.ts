import {
  LayoutDashboard,
  BookOpen,
  ChefHat,
  History,
  ReceiptText,
  Settings,
  Star,
  Table2,
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
