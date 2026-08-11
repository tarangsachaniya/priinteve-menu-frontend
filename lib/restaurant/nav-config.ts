import {
  LayoutDashboard,
  BookOpen,
  History,
  QrCode,
  ReceiptText,
  Settings,
  Star,
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
  { href: "/r/history", label: "History", icon: History },
  { href: "/r/menu", label: "Menu", icon: BookOpen },
  { href: "/r/tables", label: "Tables & QR", icon: QrCode },
  { href: "/r/reviews", label: "Reviews", icon: Star },
  { href: "/r/settings", label: "Settings", icon: Settings },
];
