"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { invoiceSectionsUpdateSchema } from "@/lib/validations/restaurant";

export type InvoiceSection = { title: string; body: string; isActive: boolean };

const MAX_SECTIONS = 6;

/**
 * Free-text blocks a restaurant adds to its own invoice — terms, a
 * thank-you note, delivery instructions, whatever the built-in fields (tax
 * details, payment status) don't cover. Printed in this order, between the
 * total/payment line and the "computer-generated" footer — see
 * services/restaurant/invoice.ts on the API.
 *
 * Same replace-the-whole-list shape as PeakHoursForm: these rows have no
 * natural key, and the order the owner leaves them in on screen becomes
 * sortOrder on save.
 */
export function InvoiceSectionsForm({ initial }: { initial: InvoiceSection[] }) {
  // Falls back rather than trusting the prop outright — every .length read
  // below would otherwise crash the whole Settings page if the API response
  // this came from was ever missing the field. See settings/page.tsx.
  const [sections, setSections] = useState<InvoiceSection[]>(initial ?? []);
  const [isSaving, setIsSaving] = useState(false);

  function addSection() {
    setSections((prev) => [...prev, { title: "", body: "", isActive: true }]);
  }

  function updateSection(index: number, patch: Partial<InvoiceSection>) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    const parsed = invoiceSectionsUpdateSchema.safeParse({ sections });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your invoice sections");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/restaurant/settings/invoice-sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save your invoice sections");
        return;
      }
      toast.success("Invoice sections saved");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">Invoice sections</p>
            <p className="text-sm text-muted-foreground">
              Extra text printed on every invoice, below the total and above the disclaimer line —
              terms, a thank-you note, delivery instructions. Turn a section off to keep it without
              printing it.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sections.length >= MAX_SECTIONS}
            onClick={addSection}
          >
            <Plus data-icon="inline-start" /> Add section
          </Button>
        </div>

        {/* Custom-section text is rendered by pdfkit's built-in Helvetica,
            which can only draw Latin script — the same limitation the invoice
            already has for a non-Latin restaurant name or address. */}
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          Printed in English/Latin script only — Devanagari, Gujarati and other non-Latin text will
          not render correctly on the PDF.
        </p>

        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No extra sections yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sections.map((section, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-2xl border border-border/70 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-2">
                    <Input
                      value={section.title}
                      onChange={(e) => updateSection(index, { title: e.target.value })}
                      placeholder="Terms & conditions"
                      maxLength={40}
                      aria-label={`Section ${index + 1} title`}
                    />
                    <Textarea
                      value={section.body}
                      onChange={(e) => updateSection(index, { body: e.target.value })}
                      placeholder="Goods once sold will not be taken back or exchanged."
                      maxLength={300}
                      rows={2}
                      aria-label={`Section ${index + 1} text`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove section ${index + 1}`}
                    onClick={() => removeSection(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`section-active-${index}`} className="cursor-pointer text-xs text-muted-foreground">
                    Printed on the invoice
                  </Label>
                  <Switch
                    id={`section-active-${index}`}
                    checked={section.isActive}
                    onCheckedChange={(checked) => updateSection(index, { isActive: checked })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <Button type="button" onClick={() => void save()} disabled={isSaving} className="self-start">
          {isSaving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {isSaving ? "Saving…" : "Save invoice sections"}
        </Button>
      </CardContent>
    </Card>
  );
}
