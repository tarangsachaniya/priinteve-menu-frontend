import { serverFetch } from "@/lib/api/server";
import type { AnnounceLanguage } from "@/lib/restaurant/announce";
import { ScreenSettings } from "@/components/restaurant/screen-settings";

export const dynamic = "force-dynamic";

type SettingsResponse = {
  restaurant: {
    kitchenToken: string | null;
    displayToken: string | null;
    screenPinSet: boolean;
    announceLanguages: AnnounceLanguage[];
  };
};

export default async function ScreensSettingsPage() {
  const { restaurant } = await serverFetch<SettingsResponse>("/api/restaurant/settings", {
    cache: "no-store",
  });

  return (
    <ScreenSettings
      initialKitchenToken={restaurant.kitchenToken}
      initialDisplayToken={restaurant.displayToken}
      initialPinSet={restaurant.screenPinSet}
      // Defensive: announceLanguages is a NOT-NULL column with a DB default,
      // but a restaurant row written through a path that predates it (or a
      // response that dropped the field) must not crash this page.
      initialAnnounceLanguages={restaurant.announceLanguages ?? ["en"]}
    />
  );
}
