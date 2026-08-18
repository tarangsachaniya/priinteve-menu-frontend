"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { restaurantSettingsPatchSchema } from "@/lib/validations/restaurant";
import {
  describeSettingsIssue,
  patchRestaurantSettings,
  ToggleRow,
} from "@/components/restaurant/settings/shared";

export type PaymentModeSettings = {
  onlinePaymentEnabled: boolean;
  counterPaymentEnabled: boolean;
  upiQrEnabled: boolean;
  upiVpa: string | null;
  upiPayeeName: string | null;
};

const PAYMENT_FIELDS = [
  "onlinePaymentEnabled",
  "counterPaymentEnabled",
  "upiQrEnabled",
  "upiVpa",
  "upiPayeeName",
] as const;

const paymentsPatchSchema = restaurantSettingsPatchSchema.pick(
  Object.fromEntries(PAYMENT_FIELDS.map((f) => [f, true])) as Record<
    (typeof PAYMENT_FIELDS)[number],
    true
  >,
);

/**
 * How a guest can pay — separate from the Razorpay gateway credentials, which
 * live on PaymentSettingsForm right below this on the same route.
 */
export function PaymentModeSettingsForm({
  settings,
  restaurantName,
  razorpayConfigured,
  upiQrAvailable,
}: {
  settings: PaymentModeSettings;
  /** Used only as the UPI payee-name placeholder. */
  restaurantName: string;
  razorpayConfigured: boolean;
  /** Whether the API will currently accept a UPI QR payment — see
   * canAcceptUpiQr() in priinteve-api. Independent of razorpayConfigured: a
   * UPI QR needs no Razorpay keys, only the platform-wide switch to be on. */
  upiQrAvailable: boolean;
}) {
  const [form, setForm] = useState({
    ...settings,
    upiVpa: settings.upiVpa ?? "",
    upiPayeeName: settings.upiPayeeName ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = paymentsPatchSchema.safeParse({
      ...form,
      // Matches what the switch below renders. Sending the row's stale `true`
      // from a deployment with no keys is what the API used to reject outright,
      // and it is how a restaurant ends up flagged for a payment method the
      // guest is never offered.
      onlinePaymentEnabled: form.onlinePaymentEnabled && razorpayConfigured,
      upiQrEnabled: form.upiQrEnabled && upiQrAvailable,
    });
    if (!parsed.success) {
      toast.error(describeSettingsIssue(parsed.error.issues[0]));
      return;
    }

    setIsSaving(true);
    try {
      const result = await patchRestaurantSettings(parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Payment settings saved");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Payment methods</CardTitle>
          <p className="text-sm text-muted-foreground">How customers can pay for an order.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(!razorpayConfigured || !upiQrAvailable) && (
            <div className="flex gap-2 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
              <Info className="size-4 shrink-0" />
              <p>
                {!razorpayConfigured && !upiQrAvailable
                  ? "Online payment and UPI QR are both temporarily unavailable across the platform. Pay at Counter is the only option right now."
                  : !razorpayConfigured
                    ? "Online payment isn't available on this deployment right now."
                    : "UPI QR is temporarily unavailable across the platform right now."}
              </p>
            </div>
          )}
          <ToggleRow
            id="online-payment"
            title="Pay Online (Razorpay)"
            description="Cards, UPI, netbanking and wallets."
            /* Shown off, not merely frozen. `disabled` blocks both directions,
               so a row carrying the schema default (true) used to render this
               switch on and immovable — the owner could see that online payment
               was enabled, could not turn it off, and the banner above claimed
               it wasn't available. Off-and-disabled tells the truth: nothing
               online is happening right now, whatever the reason. */
            checked={form.onlinePaymentEnabled && razorpayConfigured}
            disabled={!razorpayConfigured}
            onChange={(checked) => update("onlinePaymentEnabled", checked)}
          />
          <ToggleRow
            id="counter-payment"
            title="Pay at Counter / Cash on Delivery"
            description="Customer settles the invoice in person."
            checked={form.counterPaymentEnabled}
            onChange={(checked) => update("counterPaymentEnabled", checked)}
          />
          <ToggleRow
            id="upi-qr-payment"
            title="Pay by UPI QR"
            description="Shows a QR with the amount filled in. You confirm each payment yourself."
            // Same off-and-disabled treatment as the online toggle, and for the
            // same reason: a stale `true` from before the pause must not render
            // as an active switch the owner can't turn off.
            checked={form.upiQrEnabled && upiQrAvailable}
            disabled={!upiQrAvailable}
            onChange={(checked) => update("upiQrEnabled", checked)}
          />

          {form.upiQrEnabled && upiQrAvailable && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 p-3">
              {/* Said plainly and up front, because it is the one thing an
                  owner will otherwise assume works the other way round. */}
              <div className="flex gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" />
                <p>
                  A UPI QR can&apos;t tell us when it&apos;s been paid — no bank sends us a
                  confirmation. The order stays unpaid until you tap{" "}
                  <span className="font-medium text-foreground">Mark paid</span> on the orders
                  board, so check your bank alert before you do. Use a{" "}
                  <span className="font-medium text-foreground">merchant</span> UPI ID where you
                  can: a personal one has a daily limit and isn&apos;t meant for business takings.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settings-upi-vpa">UPI ID</Label>
                  <Input
                    id="settings-upi-vpa"
                    value={form.upiVpa}
                    onChange={(e) => update("upiVpa", e.target.value)}
                    placeholder="kitchen@okhdfcbank"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settings-upi-payee">Name shown to the customer</Label>
                  <Input
                    id="settings-upi-payee"
                    value={form.upiPayeeName}
                    onChange={(e) => update("upiPayeeName", e.target.value)}
                    placeholder={restaurantName || "Your restaurant"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional — defaults to your restaurant name.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSaving} className="self-start">
        {isSaving ? "Saving…" : "Save payment methods"}
      </Button>
    </form>
  );
}
