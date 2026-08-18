"use client";

import { useState } from "react";
import { Banknote, CreditCard, Info } from "lucide-react";
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

export type OrderingSettings = {
  dineInEnabled: boolean;
  takeAwayEnabled: boolean;
  deliveryEnabled: boolean;
  taxPercent: number;
  /**
   * Whether taxPercent is already folded into every menu price (a ₹200 dish
   * costs the guest ₹200) rather than added at checkout (₹210). Defaults off
   * on every existing restaurant — this only changes anything once an owner
   * opens this switch on purpose.
   */
  taxInclusive: boolean;
  deliveryFee: number;
  minOrderValue: number;
};

const ORDERING_FIELDS = [
  "dineInEnabled",
  "takeAwayEnabled",
  "deliveryEnabled",
  "taxPercent",
  "taxInclusive",
  "deliveryFee",
  "minOrderValue",
] as const;

const orderingPatchSchema = restaurantSettingsPatchSchema.pick(
  Object.fromEntries(ORDERING_FIELDS.map((f) => [f, true])) as Record<
    (typeof ORDERING_FIELDS)[number],
    true
  >,
);

/**
 * What a guest can order, and what it costs on top of the menu price.
 *
 * Order types and pricing rules used to live in separate cards (types) and
 * folded into the Payments card (tax/delivery/minimum), which put "how do I
 * pay" and "how much tax" behind the same heading for no reason beyond both
 * being money. They belong here instead — payments is about the METHOD, this
 * is about the RULES that apply regardless of method.
 */
export function OrderingSettingsForm({ settings }: { settings: OrderingSettings }) {
  const [form, setForm] = useState({
    ...settings,
    taxPercent: String(settings.taxPercent),
    deliveryFee: String(settings.deliveryFee),
    minOrderValue: String(settings.minOrderValue),
  });
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = orderingPatchSchema.safeParse(form);
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
      toast.success("Ordering settings saved");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Order types</CardTitle>
          <p className="text-sm text-muted-foreground">Customers only see the options you enable here.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ToggleRow
            id="dine-in"
            title="Dine-In"
            description="Ordering from a table QR code."
            checked={form.dineInEnabled}
            onChange={(checked) => update("dineInEnabled", checked)}
          />
          <ToggleRow
            id="take-away"
            title="Take Away"
            description="Customer collects from the counter."
            checked={form.takeAwayEnabled}
            onChange={(checked) => update("takeAwayEnabled", checked)}
          />
          <ToggleRow
            id="delivery"
            title="Delivery"
            description="Collects a delivery address and pincode at checkout."
            checked={form.deliveryEnabled}
            onChange={(checked) => update("deliveryEnabled", checked)}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
          <p className="text-sm text-muted-foreground">Tax, delivery and the smallest order you&apos;ll take.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-tax" className="flex items-center gap-1.5">
                <Banknote className="size-3.5" /> Tax (%)
              </Label>
              <Input
                id="settings-tax"
                type="number"
                min={0}
                max={50}
                value={form.taxPercent}
                onChange={(e) => update("taxPercent", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-delivery-fee" className="flex items-center gap-1.5">
                <CreditCard className="size-3.5" /> Delivery fee (₹)
              </Label>
              <Input
                id="settings-delivery-fee"
                type="number"
                min={0}
                value={form.deliveryFee}
                onChange={(e) => update("deliveryFee", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-min-order">Minimum order (₹)</Label>
              <Input
                id="settings-min-order"
                type="number"
                min={0}
                value={form.minOrderValue}
                onChange={(e) => update("minOrderValue", e.target.value)}
              />
            </div>
          </div>

          <ToggleRow
            id="tax-inclusive"
            title="Menu prices already include GST"
            description={
              form.taxInclusive
                ? `A ₹200 dish costs the guest ₹200 — GST is shown on the invoice as already included, not added at checkout.`
                : `A ₹200 dish costs the guest ₹${(200 + (200 * Number(form.taxPercent || 0)) / 100).toFixed(0)} at checkout — GST is added on top of the menu price, as it is today.`
            }
            checked={form.taxInclusive}
            onChange={(checked) => update("taxInclusive", checked)}
          />

          <div className="flex gap-2 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" />
            <p>
              Switching this does not change any price you&apos;ve set on your menu — it only changes
              whether GST is added at checkout or treated as already folded into that price. Every
              order placed before you save keeps its original total.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSaving} className="self-start">
        {isSaving ? "Saving…" : "Save ordering settings"}
      </Button>
    </form>
  );
}
