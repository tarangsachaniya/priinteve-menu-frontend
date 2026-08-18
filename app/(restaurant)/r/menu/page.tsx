import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import { PageShell } from "@/components/shared/page-shell";
import { MenuManager } from "@/components/restaurant/menu-manager";

export const dynamic = "force-dynamic";

type Category = { id: string; name: string; description: string | null; sortOrder: number; isActive: boolean };
type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  imagePublicId: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  badge: string | null;
  prepMinutes: number | null;
  demoteAtPeak: boolean;
  sortOrder: number;
  variants: { id: string; name: string; priceDelta: number; isDefault: boolean }[];
  addOns: { id: string; name: string; price: number }[];
};

export default async function RestaurantMenuPage() {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  const [{ categories }, { items }] = await Promise.all([
    serverFetch<{ categories: Category[] }>("/api/restaurant/categories", { cache: "no-store" }),
    serverFetch<{ items: MenuItem[] }>("/api/restaurant/menu-items", { cache: "no-store" }),
  ]);

  return (
    <PageShell
      icon={BookOpen}
      title="Menu"
      description="Organise your dishes into categories and keep availability up to date."
    >
      <MenuManager initialCategories={categories} initialItems={items} />
    </PageShell>
  );
}
