import type { Metadata } from "next";

import { ClosedNotice } from "@/components/order/closed-notice";

/**
 * What a dead ordering URL renders.
 *
 * Reached by notFound() from the menu and table routes, so it covers three
 * cases that used to be answered with a friendly notice and a 200: a mistyped
 * slug, a QR code whose table has been retired, and a restaurant the platform
 * has switched off. All three are genuinely absent, and a 200 told crawlers
 * otherwise while giving a guest no signal that the link itself was wrong.
 */
export const metadata: Metadata = {
  title: "Menu not found",
  description: "This ordering link isn't active.",
  robots: { index: false, follow: false },
};

export default function OrderNotFound() {
  return (
    <ClosedNotice
      title="This menu isn't available"
      message="The link may be mistyped, or this QR code is no longer in use. Please ask a staff member for the current code."
    />
  );
}
