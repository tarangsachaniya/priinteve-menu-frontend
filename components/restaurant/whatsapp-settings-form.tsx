"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";

export type WhatsappSettings = {
  /** Read-only here — Admin's own on/off switch (restaurant-detail-panel.tsx) controls this, not this form. */
  isEnabled: boolean;
  /** Rupees per message, or null if a rate has never been set. */
  currentRate: number | null;
};

/**
 * Rendered on both the admin restaurant-detail page (`editable`, the rate
 * can be saved) and the restaurant's own Settings > WhatsApp page
 * (`editable={false}`, the rate is shown but never writable there — a
 * restaurant owner may view but never set the rate). This is the one
 * deliberate deviation from LoyaltySettingsForm's "identical component, only
 * the endpoint swapped" shape: WhatsApp's rate is Admin-only to set, not a
 * primary-once-enabled path the restaurant later takes over.
 */
export function WhatsAppSettingsForm({
  endpoint,
  initial,
  editable,
}: {
  endpoint: string;
  initial: WhatsappSettings;
  editable: boolean;
}) {
  const [unitPrice, setUnitPrice] = useState(initial.currentRate ?? 0);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPrice: Number(unitPrice) }),
      });

      if (!res.ok) {
        toast.error("Could not save the WhatsApp rate");
        return;
      }
      toast.success("WhatsApp rate saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4" />
          WhatsApp Messaging
        </CardTitle>
        <CardDescription>
          {editable
            ? "The per-message charge for order-completed WhatsApp receipts."
            : "Your current rate for order-completed WhatsApp receipts."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {editable ? (
          <form onSubmit={save} className="flex flex-col gap-3">
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="whatsapp-rate">Rate per message (₹)</Label>
              <Input
                id="whatsapp-rate"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                disabled={busy}
              />
            </div>
            <div>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save Rate"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-2xl font-bold">
            {initial.currentRate !== null ? `${formatCurrency(initial.currentRate)} / message` : "Not set yet"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
