import { serverFetch } from "@/lib/api/server";
import {
  PaymentModeSettingsForm,
  type PaymentModeSettings,
} from "@/components/restaurant/settings/payments-form";
import { PaymentSettingsForm, type PaymentSettings } from "@/components/restaurant/payment-settings-form";

export const dynamic = "force-dynamic";

type SettingsResponse = {
  restaurant: PaymentModeSettings & { name: string };
  razorpayConfigured: boolean;
  upiQrAvailable: boolean;
};

export default async function PaymentsSettingsPage() {
  /**
   * Two calls, not three: payment credentials have their own endpoint and
   * their own secret-stripping rules (see PaymentSettingsForm's header
   * comment), so they never ride along on the general settings response. Both
   * tolerate failure independently — a still-deploying API missing the
   * Razorpay route must not take down the payment-mode toggles above it.
   */
  const [{ restaurant, razorpayConfigured, upiQrAvailable }, payment] = await Promise.all([
    serverFetch<SettingsResponse>("/api/restaurant/settings", { cache: "no-store" }),
    serverFetch<PaymentSettings>("/api/restaurant/settings/payment", { cache: "no-store" }).catch(
      () => null,
    ),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <PaymentModeSettingsForm
        settings={restaurant}
        restaurantName={restaurant.name}
        razorpayConfigured={razorpayConfigured}
        upiQrAvailable={upiQrAvailable}
      />

      {payment && (
        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Razorpay account</h2>
          <PaymentSettingsForm endpoint="/api/restaurant/settings/payment" initial={payment} />
        </section>
      )}
    </div>
  );
}
