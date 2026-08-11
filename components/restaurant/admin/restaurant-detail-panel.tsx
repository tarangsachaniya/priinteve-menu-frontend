"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatMobile } from "@/lib/restaurant/mobile";
import { restaurantUpdateSchema } from "@/lib/validations/restaurant";

export type AdminRestaurantDetail = {
  id: string;
  name: string;
  branch: string | null;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  ownerEmail: string | null;
  ownerName: string | null;
  orderUrl: string;
};

export function RestaurantDetailPanel({ restaurant }: { restaurant: AdminRestaurantDetail }) {
  const [form, setForm] = useState({
    name: restaurant.name,
    branch: restaurant.branch ?? "",
    phone: restaurant.phone ? formatMobile(restaurant.phone) : "",
    email: restaurant.email ?? "",
    address: restaurant.address ?? "",
    isActive: restaurant.isActive,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const parsed = restaurantUpdateSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the details");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        toast.error("Could not save changes");
        return;
      }
      toast.success("Saved");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordReset() {
    setIsResetting(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurant.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Could not reset password");
        return;
      }
      setNewPassword(data.credentials.password);
      toast.success("Password reset");
    } finally {
      setIsResetting(false);
    }
  }

  async function copyCredentials() {
    if (!newPassword) return;
    await navigator.clipboard.writeText(
      `Email: ${restaurant.ownerEmail}\nPassword: ${newPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Restaurant details</CardTitle>
          <CardDescription>Contact information and availability.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="detail-name">Name</Label>
                <Input
                  id="detail-name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="detail-branch">Branch / Area</Label>
                <Input
                  id="detail-branch"
                  value={form.branch}
                  onChange={(e) => update("branch", e.target.value)}
                  placeholder="Bandra West"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="detail-phone">Phone</Label>
                <Input
                  id="detail-phone"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="9876543210"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="detail-email">Contact email</Label>
                <Input
                  id="detail-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="detail-address">Address</Label>
              <Textarea
                id="detail-address"
                rows={2}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Accepting orders</p>
                <p className="text-xs text-muted-foreground">
                  When paused, customers see a closed notice instead of the menu.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => update("isActive", checked)}
                aria-label="Accepting orders"
              />
            </div>

            <Button type="submit" disabled={isSaving} className="self-start">
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" />
            Owner login
          </CardTitle>
          <CardDescription>Signs in at /r/login.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-2xl bg-muted p-3 text-sm">
            <p className="font-medium">{restaurant.ownerName ?? "—"}</p>
            <p className="break-all text-muted-foreground">{restaurant.ownerEmail ?? "—"}</p>
          </div>

          {newPassword && (
            <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                New password — shown once, copy it now.
              </p>
              <p className="font-mono text-sm">{newPassword}</p>
              <Button type="button" variant="outline" size="xs" onClick={copyCredentials}>
                {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePasswordReset}
            disabled={isResetting}
          >
            {isResetting ? "Resetting…" : "Reset password"}
          </Button>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Customer ordering URL</p>
            <a
              href={restaurant.orderUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm underline-offset-4 hover:underline"
            >
              {restaurant.orderUrl}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
