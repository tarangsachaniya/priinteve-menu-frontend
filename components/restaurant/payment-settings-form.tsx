"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Where a restaurant enters its OWN Razorpay account.
 *
 * ─── The one rule this form is built around ─────────────────────────────────
 *
 * IT NEVER RECEIVES A SECRET. The API answers with `razorpayKeySecretSet: true`
 * and nothing more, so there is no stored credential in this page's props, in
 * React state, or in the HTML — and therefore nothing to leak through a
 * screenshot, a browser extension, or a support call over shared screen.
 *
 * That is also why an empty secret field means "leave it alone" rather than
 * "clear it". The form genuinely cannot re-send what it was never given, so
 * saving a toggle without retyping the secret has to work. Clearing is the
 * separate Remove button, which is unambiguous about what it does.
 *
 * `endpoint` is passed in because the platform admin screen renders this same
 * form against /api/admin/restaurants/:id/payment. One component, so the two
 * cannot drift about which fields are secret.
 */

export type PaymentSettings = {
  razorpayEnabled: boolean;
  razorpayKeyId: string | null;
  razorpayKeySecretSet: boolean;
  razorpayWebhookSecretSet: boolean;
  webhookUrl: string;
  canStoreCredentials: boolean;
};

export function PaymentSettingsForm({
  endpoint,
  initial,
}: {
  endpoint: string;
  initial: PaymentSettings;
}) {
  const [saved, setSaved] = useState(initial);
  const [enabled, setEnabled] = useState(initial.razorpayEnabled);
  const [keyId, setKeyId] = useState(initial.razorpayKeyId ?? "");
  // Always start blank. See the note above: these hold a NEW value being typed,
  // never the stored one.
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayEnabled: enabled,
          razorpayKeyId: keyId.trim(),
          // Omitted entirely when untouched — the server reads an absent field
          // as "keep the stored value".
          ...(keySecret ? { razorpayKeySecret: keySecret } : {}),
          ...(webhookSecret ? { razorpayWebhookSecret: webhookSecret } : {}),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<PaymentSettings> & {
        error?: unknown;
      };

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save payment details");
        return;
      }

      setSaved(data as PaymentSettings);
      setEnabled((data as PaymentSettings).razorpayEnabled);
      setKeyId((data as PaymentSettings).razorpayKeyId ?? "");
      // Cleared on success so the fields go back to reading "already set" —
      // leaving a typed secret on screen after saving is a credential sitting
      // in a form on a till in a public room.
      setKeySecret("");
      setWebhookSecret("");
      toast.success("Payment details saved");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not remove the credentials");
        return;
      }
      const data = (await res.json()) as PaymentSettings;
      setSaved(data);
      setEnabled(false);
      setKeyId("");
      setKeySecret("");
      setWebhookSecret("");
      toast.success("Razorpay credentials removed");
    } finally {
      setBusy(false);
    }
  }

  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(saved.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" />
          Razorpay account
        </CardTitle>
        <CardDescription>
          Payments go straight into your own Razorpay account. Leave this off to keep using the
          platform&apos;s account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-5">
          {!saved.canStoreCredentials && (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800">
              This server isn&apos;t set up to store payment credentials securely yet. Contact
              support before entering your keys.
            </p>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="rzp-enabled">Use my own Razorpay account</Label>
              <p className="text-xs text-muted-foreground">
                Turn this on once your Key ID and Key Secret are saved.
              </p>
            </div>
            <Switch
              id="rzp-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={busy || !saved.canStoreCredentials}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rzp-key-id">Key ID</Label>
            <Input
              id="rzp-key-id"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="rzp_live_xxxxxxxxxxxx"
              autoComplete="off"
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              From Razorpay Dashboard → Settings → API Keys. Not a secret — it appears in the
              checkout window.
            </p>
          </div>

          <SecretField
            id="rzp-key-secret"
            label="Key Secret"
            value={keySecret}
            onChange={setKeySecret}
            isSet={saved.razorpayKeySecretSet}
            disabled={busy}
            hint="Shown by Razorpay only once, when you generate the key."
          />

          <SecretField
            id="rzp-webhook-secret"
            label="Webhook Secret"
            value={webhookSecret}
            onChange={setWebhookSecret}
            isSet={saved.razorpayWebhookSecretSet}
            disabled={busy}
            hint="The secret you type when adding the webhook below in Razorpay."
          />

          <div className="flex flex-col gap-1.5">
            <Label>Webhook URL</Label>
            <div className="flex items-center gap-2">
              <Input value={saved.webhookUrl} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={() => void copyWebhookUrl()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this in Razorpay Dashboard → Settings → Webhooks, with the{" "}
              <strong>payment.captured</strong> and <strong>payment.failed</strong> events. This is
              what marks an order paid.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !saved.canStoreCredentials}>
              {busy ? "Saving…" : "Save"}
            </Button>
            {(saved.razorpayKeyId || saved.razorpayKeySecretSet) && (
              <Button type="button" variant="outline" onClick={() => void remove()} disabled={busy}>
                Remove credentials
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * A secret input that shows whether one is stored without ever showing it.
 *
 * Empty and a "saved" note when one exists, because that is precisely the state
 * the server reports back — presence, never the value.
 */
function SecretField({
  id,
  label,
  value,
  onChange,
  isSet,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  isSet: boolean;
  disabled: boolean;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {isSet && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Check className="size-3.5" />
            Saved
          </span>
        )}
      </div>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSet ? "Leave blank to keep the saved one" : "Paste it here"}
        autoComplete="new-password"
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
