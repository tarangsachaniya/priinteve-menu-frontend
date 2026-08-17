import { redirect } from "next/navigation";

import { getRestaurantSession } from "@/lib/api/server";
import { OrderAlertProvider } from "@/components/restaurant/order-alert-provider";

/**
 * A second shell for the restaurant realm, holding only the kitchen display.
 *
 * WHY A SEPARATE ROUTE GROUP: (restaurant)/layout.tsx wraps everything in the
 * sidebar and a max-width column. A wall-mounted kitchen tablet has neither the
 * room for the sidebar nor anyone who wants to navigate away from the tickets,
 * so /r/kitchen escapes that chrome by living in its own group. Route groups
 * don't affect the URL, so this still serves /r/kitchen and is still covered by
 * middleware.ts's /r/:path* matcher.
 *
 * The auth check is identical and for the identical reason: GET
 * /api/restaurant/session reads the restaurant fresh from the database rather
 * than trusting the cookie, so an account paused after the session was minted
 * loses access immediately. middleware.ts only avoids the flash.
 */
export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const data = await getRestaurantSession();
  if (!data) {
    redirect("/r/login");
  }

  return (
    <div className="min-h-screen bg-muted">
      {children}
      {/*
        The drum, but not the dialog. Every PLACED ticket is already on this
        screen at three times the board's size with an Accept button on it, so a
        modal would cover the exact thing it is alerting about — and clearing it
        costs a tap from someone whose hands are full. The ringing pill and the
        sound-unlock affordance still render.
      */}
      <OrderAlertProvider showDialog={false} surface="kitchen" />
    </div>
  );
}
