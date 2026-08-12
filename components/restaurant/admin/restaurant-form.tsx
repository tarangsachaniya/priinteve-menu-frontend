"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OpenState } from "@/lib/restaurant/hours";
import { restaurantCreateSchema } from "@/lib/validations/restaurant";

export type AdminRestaurant = {
  id: string;
  name: string;
  branch: string | null;
  slug: string;
  phone: string | null;
  isActive: boolean;
  /**
   * Whether the kitchen is taking orders right now, in the restaurant's own
   * timezone — resolved by the API with the same function the guest menu uses.
   * Distinct from isActive, which is the platform switch. Optional because a
   * freshly created restaurant is returned by POST before this is computed.
   */
  openState?: OpenState;
  ownerEmail: string | null;
  tableCount: number;
  menuItemCount: number;
  orderCount: number;
  createdAt: string | Date;
};

const EMPTY_FORM = {
  name: "",
  branch: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  phone: "",
  address: "",
  tableCount: "",
};

/**
 * Shown once after a restaurant is created. These credentials are the only
 * copy — the server stores a hash, so there is no way to display them again.
 */
function CredentialsPanel({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div>
        <p className="text-sm font-semibold">Owner login created</p>
        <p className="text-xs text-muted-foreground">
          Save these now — the password is hashed and can&apos;t be shown again. You can always
          reset it from the restaurant&apos;s detail page.
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="truncate">{email}</dd>
        <dt className="text-muted-foreground">Password</dt>
        <dd>{password}</dd>
      </dl>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={copy}>
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? "Copied" : "Copy credentials"}
      </Button>
    </div>
  );
}

export function RestaurantForm({
  onCreated,
  trigger,
}: {
  onCreated: (restaurant: AdminRestaurant) => void;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = restaurantCreateSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the restaurant details");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not create restaurant");
        return;
      }

      toast.success("Restaurant created");
      setCredentials(data.credentials);
      onCreated({
        ...data.restaurant,
        branch: form.branch,
        phone: form.phone || null,
        ownerEmail: form.ownerEmail,
        tableCount: data.restaurant.tableCount ?? 0,
        menuItemCount: 0,
        orderCount: 0,
        createdAt: new Date(),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function reset() {
    setForm(EMPTY_FORM);
    setCredentials(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{credentials ? "Restaurant ready" : "Add restaurant"}</DialogTitle>
          <DialogDescription>
            {credentials
              ? "Hand these credentials to the restaurant so they can sign in at /r/login."
              : "Creates the restaurant and its owner login in one step."}
          </DialogDescription>
        </DialogHeader>

        {credentials ? (
          <div className="flex flex-col gap-4">
            <CredentialsPanel email={credentials.email} password={credentials.password} />
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="scrollbar-none flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-1"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="restaurant-name">Restaurant name</Label>
              <Input
                id="restaurant-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Spice Garden"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="restaurant-branch">Branch / Area</Label>
              <Input
                id="restaurant-branch"
                value={form.branch}
                onChange={(e) => update("branch", e.target.value)}
                placeholder="Bandra West"
                required
                minLength={2}
              />
              <p className="text-xs text-muted-foreground">
                Distinguishes outlets of the same brand and feeds the ordering URL. A single
                outlet still needs one — its city or &ldquo;Main&rdquo; works.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-name">Owner name</Label>
              <Input
                id="owner-name"
                value={form.ownerName}
                onChange={(e) => update("ownerName", e.target.value)}
                placeholder="Ravi Kumar"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-email">Owner email (login)</Label>
              <Input
                id="owner-email"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => update("ownerEmail", e.target.value)}
                placeholder="owner@spicegarden.in"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-password">Owner password</Label>
              <PasswordInput
                id="owner-password"
                autoComplete="new-password"
                value={form.ownerPassword}
                onChange={(e) => update("ownerPassword", e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                The owner signs in at <span className="font-medium text-foreground">/r/login</span>{" "}
                with this email and password.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="restaurant-phone">Phone (optional)</Label>
              <Input
                id="restaurant-phone"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="9876543210"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="restaurant-address">Address (optional)</Label>
              <Textarea
                id="restaurant-address"
                rows={2}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="restaurant-tables">Number of tables</Label>
              <Input
                id="restaurant-tables"
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                value={form.tableCount}
                onChange={(e) => update("tableCount", e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Creates Table 1 to Table N, each with its own QR code and ordering link, so the
                kitchen can see which table an order came from. Leave at 0 for takeaway-only.
                Tables can be added or renamed later.
              </p>
            </div>

            <Button type="submit" disabled={isSaving} className="mt-1">
              {isSaving ? "Creating…" : "Create restaurant"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
