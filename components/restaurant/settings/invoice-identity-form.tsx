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
} from "@/components/restaurant/settings/shared";

export type InvoiceIdentitySettings = {
  legalName: string | null;
  gstin: string | null;
  fssaiLicence: string | null;
};

const INVOICE_IDENTITY_FIELDS = ["legalName", "gstin", "fssaiLicence"] as const;

const invoiceIdentityPatchSchema = restaurantSettingsPatchSchema.pick(
  Object.fromEntries(INVOICE_IDENTITY_FIELDS.map((f) => [f, true])) as Record<
    (typeof INVOICE_IDENTITY_FIELDS)[number],
    true
  >,
);

/**
 * The legal identity printed on the PDF invoice — not to be confused with
 * InvoiceSectionsForm right below it on the same route, which edits free-text
 * blocks rather than tax registration fields. Kept as two components because
 * they save to different logic (this one is a settings PATCH; sections have
 * their own replace-the-list endpoint) even though they render on one page.
 */
export function InvoiceIdentityForm({
  settings,
  restaurantName,
}: {
  settings: InvoiceIdentitySettings;
  /** Used only as the legal-name placeholder. */
  restaurantName: string;
}) {
  const [form, setForm] = useState({
    legalName: settings.legalName ?? "",
    gstin: settings.gstin ?? "",
    fssaiLicence: settings.fssaiLicence ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = invoiceIdentityPatchSchema.safeParse(form);
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
      toast.success("Invoice details saved");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Invoice details</CardTitle>
          <p className="text-sm text-muted-foreground">
            What appears on the PDF invoice you and your customers can download.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Stated once, plainly, because it is the thing that decides what
              kind of document leaves the building. */}
          <div className="flex gap-2 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" />
            <p>
              Add a GSTIN and every invoice becomes a proper{" "}
              <span className="font-medium text-foreground">tax invoice</span>, with GST split into
              CGST and SGST. Leave it blank and customers still get a clean invoice — just not one
              that claims a registration you don&apos;t have.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-legal-name">Registered business name</Label>
              <Input
                id="settings-legal-name"
                value={form.legalName}
                onChange={(e) => update("legalName", e.target.value)}
                placeholder={restaurantName || "Sharma Hospitality Pvt Ltd"}
              />
              <p className="text-xs text-muted-foreground">
                Optional — only if it differs from {restaurantName || "your restaurant name"}.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-gstin">GSTIN</Label>
              <Input
                id="settings-gstin"
                value={form.gstin}
                onChange={(e) => update("gstin", e.target.value.toUpperCase())}
                placeholder="27AAACR1234R1ZQ"
                maxLength={15}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Your state is read from the first two digits, so you don&apos;t need to enter it.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-fssai">FSSAI licence number</Label>
              <Input
                id="settings-fssai"
                value={form.fssaiLicence}
                onChange={(e) => update("fssaiLicence", e.target.value)}
                placeholder="11522998000123"
                maxLength={20}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Required on food invoices in India.</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Your address, phone and email from{" "}
            <span className="font-medium text-foreground">Profile</span> are printed on the invoice
            too — make sure the address there is your full postal one.
          </p>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSaving} className="self-start">
        {isSaving ? "Saving…" : "Save invoice details"}
      </Button>
    </form>
  );
}
