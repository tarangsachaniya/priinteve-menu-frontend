import { serverFetch } from "@/lib/api/server";
import { ProfileSettingsForm, type ProfileSettings } from "@/components/restaurant/settings/profile-form";

export const dynamic = "force-dynamic";

type SettingsResponse = {
  restaurant: ProfileSettings;
  publishedReviews: number;
};

/**
 * Identity, branding and menu-page presentation.
 *
 * One fetch — GET /api/restaurant/settings already returns the whole
 * restaurant row plus publishedReviews, so this section reads the fields it
 * needs from that and ignores the rest, rather than requesting anything the
 * other sections use (payment credentials, audio settings) the way the old
 * single-page Settings did before every section could save independently.
 */
export default async function ProfileSettingsPage() {
  const { restaurant, publishedReviews } = await serverFetch<SettingsResponse>(
    "/api/restaurant/settings",
    { cache: "no-store" },
  );

  return <ProfileSettingsForm settings={restaurant} publishedReviews={publishedReviews} />;
}
