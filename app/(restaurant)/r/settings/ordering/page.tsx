import { serverFetch } from "@/lib/api/server";
import { OrderingSettingsForm, type OrderingSettings } from "@/components/restaurant/settings/ordering-form";

export const dynamic = "force-dynamic";

type SettingsResponse = { restaurant: OrderingSettings };

/** What a guest can order, and the tax/delivery/minimum rules that apply. */
export default async function OrderingSettingsPage() {
  const { restaurant } = await serverFetch<SettingsResponse>("/api/restaurant/settings", {
    cache: "no-store",
  });

  return <OrderingSettingsForm settings={restaurant} />;
}
