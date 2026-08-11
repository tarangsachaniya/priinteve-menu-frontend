import { redirect } from "next/navigation";

import { getRestaurantSession } from "@/lib/api/server";
import { RestaurantSidebar } from "@/components/restaurant/restaurant-sidebar";

/**
 * The guard for the whole restaurant console.
 *
 * GET /api/restaurant/session reads the restaurant fresh from the database,
 * not the cookie: an account that was paused after the session was minted
 * must lose access immediately. middleware.ts already redirects an absent
 * or invalid pv_resto cookie before this runs, but re-checking here is what
 * catches a paused account with an otherwise-valid session.
 */
export default async function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const data = await getRestaurantSession();
  if (!data) {
    redirect("/r/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted md:flex-row">
      <RestaurantSidebar restaurantName={data.restaurant.name} email={data.session.email} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
