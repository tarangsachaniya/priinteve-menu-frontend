import { serverFetch } from "@/lib/api/server";
import { HoursForm } from "@/components/restaurant/hours-form";
import { PeakHoursForm } from "@/components/restaurant/peak-hours-form";

export const dynamic = "force-dynamic";

type SettingsResponse = {
  restaurant: {
    timezone: string;
    acceptingOrders: boolean;
    closedMessage: string | null;
    hours: { dayOfWeek: number; opensAt: number; closesAt: number; isClosed: boolean }[];
    peakWindows: { dayOfWeek: number; startsAt: number; endsAt: number; label: string | null }[];
  };
  demotedDishCount: number;
};

export default async function HoursSettingsPage() {
  const { restaurant, demotedDishCount } = await serverFetch<SettingsResponse>(
    "/api/restaurant/settings",
    { cache: "no-store" },
  );

  return (
    <div className="flex flex-col gap-10">
      <section>
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

      <section>
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
    </div>
  );
}
