import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import type { AnnounceLanguage } from "@/lib/restaurant/announce";
import { normalizeRestoMode } from "@/lib/restaurant/theme";
import { PageHeader } from "@/components/shared/page-header";
import { AlertSettings } from "@/components/restaurant/alert-settings";
import { HoursForm } from "@/components/restaurant/hours-form";
import { PeakHoursForm } from "@/components/restaurant/peak-hours-form";
import { ScreenSettings } from "@/components/restaurant/screen-settings";
import { SettingsForm } from "@/components/restaurant/settings-form";

export const dynamic = "force-dynamic";

type SettingsResponse = {
  restaurant: {
    name: string;
    branch: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    brandColor: string;
    themeMode: string | null;
    coverImageUrl: string | null;
    coverPublicId: string | null;
    logoUrl: string | null;
    logoPublicId: string | null;
    tagline: string | null;
    description: string | null;
    cuisineTags: string[];
    prepTimeMinMins: number | null;
    prepTimeMaxMins: number | null;
    costForTwo: number | null;
    ratingValue: number | null;
    ratingCount: number | null;
    dineInEnabled: boolean;
    takeAwayEnabled: boolean;
    deliveryEnabled: boolean;
    onlinePaymentEnabled: boolean;
    counterPaymentEnabled: boolean;
    upiQrEnabled: boolean;
    upiVpa: string | null;
    upiPayeeName: string | null;
    legalName: string | null;
    gstin: string | null;
    fssaiLicence: string | null;
    taxPercent: number;
    deliveryFee: number;
    minOrderValue: number;
    timezone: string;
    acceptingOrders: boolean;
    closedMessage: string | null;
    kitchenToken: string | null;
    displayToken: string | null;
    announceLanguages: AnnounceLanguage[];
    /**
     * Whether a screen PIN exists — never the hash itself. The settings route
     * strips screenPinHash and substitutes this bit; see its comment for why.
     */
    screenPinSet: boolean;
    // Minutes from midnight in the restaurant's timezone (Prisma Int columns,
    // not clock strings) — see prisma/schema.prisma's RestaurantHours/
    // RestaurantPeakWindow models on the API.
    hours: { dayOfWeek: number; opensAt: number; closesAt: number; isClosed: boolean }[];
    peakWindows: { dayOfWeek: number; startsAt: number; endsAt: number; label: string | null }[];
  };
  razorpayConfigured: boolean;
  upiQrAvailable: boolean;
  publishedReviews: number;
  demotedDishCount: number;
};

export default async function RestaurantSettingsPage() {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  const { restaurant, razorpayConfigured, upiQrAvailable, publishedReviews, demotedDishCount } =
    await serverFetch<SettingsResponse>("/api/restaurant/settings", { cache: "no-store" });

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8 lg:p-10">
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Order types, payment options and how your restaurant appears to customers."
      />

      <SettingsForm
        razorpayConfigured={razorpayConfigured}
        upiQrAvailable={upiQrAvailable}
        publishedReviews={publishedReviews}
        settings={{
          name: restaurant.name,
          branch: restaurant.branch,
          phone: restaurant.phone,
          email: restaurant.email,
          address: restaurant.address,
          brandColor: restaurant.brandColor,
          themeMode: normalizeRestoMode(restaurant.themeMode),
          coverImageUrl: restaurant.coverImageUrl,
          coverPublicId: restaurant.coverPublicId,
          logoUrl: restaurant.logoUrl,
          logoPublicId: restaurant.logoPublicId,
          tagline: restaurant.tagline,
          description: restaurant.description,
          cuisineTags: restaurant.cuisineTags,
          prepTimeMinMins: restaurant.prepTimeMinMins,
          prepTimeMaxMins: restaurant.prepTimeMaxMins,
          costForTwo: restaurant.costForTwo,
          ratingValue: restaurant.ratingValue,
          ratingCount: restaurant.ratingCount,
          dineInEnabled: restaurant.dineInEnabled,
          takeAwayEnabled: restaurant.takeAwayEnabled,
          deliveryEnabled: restaurant.deliveryEnabled,
          onlinePaymentEnabled: restaurant.onlinePaymentEnabled,
          counterPaymentEnabled: restaurant.counterPaymentEnabled,
          upiQrEnabled: restaurant.upiQrEnabled,
          upiVpa: restaurant.upiVpa,
          upiPayeeName: restaurant.upiPayeeName,
          legalName: restaurant.legalName,
          gstin: restaurant.gstin,
          fssaiLicence: restaurant.fssaiLicence,
          taxPercent: restaurant.taxPercent,
          deliveryFee: restaurant.deliveryFee,
          minOrderValue: restaurant.minOrderValue,
        }}
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Order alerts</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Ring this device when an order comes in, so nobody has to watch the board. Set up each
          phone, tablet and till separately — they each need their own permission.
        </p>
        <AlertSettings />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Screens</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          A kitchen display for the pass and a pickup board your guests can read. Each runs on its
          own link and unlocks with one shared PIN — neither signs in as staff, so a screen on the
          wall can never reach the rest of your console.
        </p>
        <ScreenSettings
          initialKitchenToken={restaurant.kitchenToken}
          initialDisplayToken={restaurant.displayToken}
          initialPinSet={restaurant.screenPinSet}
          initialAnnounceLanguages={restaurant.announceLanguages}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Opening hours</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Customers see an Open or Closed badge on your menu, and orders are refused outside these hours.
        </p>
        <HoursForm
          initial={{
            timezone: restaurant.timezone,
            acceptingOrders: restaurant.acceptingOrders,
            closedMessage: restaurant.closedMessage,
            hours: restaurant.hours,
          }}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Rush hours</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          When your kitchen is busiest. Dishes you marked &ldquo;Hide during rush&rdquo; move to the last
          page of your menu during these windows, so fewer guests order them while you&apos;re under load.
        </p>
        <PeakHoursForm
          demotedDishCount={demotedDishCount}
          initial={{ timezone: restaurant.timezone, windows: restaurant.peakWindows }}
        />
      </section>
    </main>
  );
}
