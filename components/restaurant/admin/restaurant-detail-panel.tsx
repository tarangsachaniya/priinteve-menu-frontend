"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Printer } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { RestoKotPrinterMode, RestoOperationType, RestoPrinterRole } from "@/lib/api/enums";
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
  operationType: RestoOperationType;
  kotPrinterMode: RestoKotPrinterMode | null;
  kitchenEnabled: boolean;
  pickupEnabled: boolean;
  tvEnabled: boolean;
};

type OperationTypeChangeResult = {
  restaurant: { operationType: RestoOperationType; kotPrinterMode: RestoKotPrinterMode | null };
  deactivatedPrinters: { id: string; name: string; role: RestoPrinterRole }[];
  failedJobCount: number;
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

  // Independent of the contact-details form above — these three PATCH
  // straight away, same immediate-effect pattern as ScreenSettings, rather
  // than waiting on the "Save changes" button below which only covers name/
  // branch/phone/email/address/isActive.
  const [modules, setModules] = useState({
    kitchenEnabled: restaurant.kitchenEnabled,
    pickupEnabled: restaurant.pickupEnabled,
    tvEnabled: restaurant.tvEnabled,
  });
  const [savingModule, setSavingModule] = useState<keyof typeof modules | null>(null);

  // operationType itself is never in `form` above — it has no place on the
  // contact-details PATCH at all (see restaurantUpdateSchema), only its own
  // confirm-gated endpoint below.
  const [operationType, setOperationType] = useState(restaurant.operationType);
  const [kotPrinterMode, setKotPrinterMode] = useState(restaurant.kotPrinterMode);
  const [confirmingOperationType, setConfirmingOperationType] = useState<RestoOperationType | null>(null);
  const [isChangingOperationType, setIsChangingOperationType] = useState(false);

  async function toggleModule(key: keyof typeof modules) {
    const next = !modules[key];
    const previous = modules;
    setModules((prev) => ({ ...prev, [key]: next }));
    setSavingModule(key);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) {
        setModules(previous);
        toast.error("Could not update this module");
        return;
      }
      toast.success("Saved");
    } finally {
      setSavingModule(null);
    }
  }

  async function changeOperationType() {
    if (!confirmingOperationType) return;
    const next = confirmingOperationType;
    setConfirmingOperationType(null);
    setIsChangingOperationType(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurant.id}/operation-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationType: next }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<OperationTypeChangeResult> & {
        error?: unknown;
      };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not change the operation type");
        return;
      }

      setOperationType(data.restaurant?.operationType ?? next);
      setKotPrinterMode(data.restaurant?.kotPrinterMode ?? null);

      const deactivated = data.deactivatedPrinters?.length ?? 0;
      const failedJobs = data.failedJobCount ?? 0;
      if (deactivated > 0 || failedJobs > 0) {
        toast.success(
          `Switched to ${next}. Deactivated ${deactivated} printer${deactivated === 1 ? "" : "s"}, failed ${failedJobs} pending print job${failedJobs === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success(`Switched to ${next}`);
      }
    } finally {
      setIsChangingOperationType(false);
    }
  }

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
    <>
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

      <Card className="mt-6 border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="size-4" />
            Printing &amp; modules
          </CardTitle>
          <CardDescription>
            Billing/printing architecture and the operational boards this restaurant has access to.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 p-3">
            <div>
              <p className="text-sm font-medium">
                Operation type: <Badge variant="secondary">{operationType}</Badge>
                {operationType === "KOT" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Printer mode: {kotPrinterMode ?? "not chosen yet"}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Managed by Administrator — the restaurant can view this but never change it.
                {operationType === "KOT"
                  ? " The restaurant chooses its own One-Way / Two-Way printer mode from its own Settings."
                  : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isChangingOperationType}
              onClick={() => setConfirmingOperationType(operationType === "KOT" ? "DBS" : "KOT")}
            >
              {isChangingOperationType ? "Switching…" : `Change to ${operationType === "KOT" ? "DBS" : "KOT"}`}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Kitchen board</p>
                <p className="text-xs text-muted-foreground">
                  Independent of operation type. Turns /r/kitchen and the kitchen TV/tablet off for
                  this restaurant.
                </p>
              </div>
              <Switch
                checked={modules.kitchenEnabled}
                disabled={savingModule === "kitchenEnabled"}
                onCheckedChange={() => void toggleModule("kitchenEnabled")}
                aria-label="Kitchen board enabled"
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Pickup board</p>
                <p className="text-xs text-muted-foreground">
                  Turns the pickup board and its screen link off for this restaurant.
                </p>
              </div>
              <Switch
                checked={modules.pickupEnabled}
                disabled={savingModule === "pickupEnabled"}
                onCheckedChange={() => void toggleModule("pickupEnabled")}
                aria-label="Pickup board enabled"
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">TV pairing</p>
                <p className="text-xs text-muted-foreground">
                  Turns off the ability to pair a new Kitchen/Pickup TV for this restaurant.
                </p>
              </div>
              <Switch
                checked={modules.tvEnabled}
                disabled={savingModule === "tvEnabled"}
                onCheckedChange={() => void toggleModule("tvEnabled")}
                aria-label="TV pairing enabled"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmingOperationType !== null}
        onOpenChange={(open) => !open && setConfirmingOperationType(null)}
        variant="destructive"
        title={`Switch this restaurant to ${confirmingOperationType}?`}
        description={
          confirmingOperationType === "KOT"
            ? "Every currently-active printer will be deactivated and any pending print jobs on them will fail — the restaurant will need to choose One-Way or Two-Way printing and set printers up again from their own Settings."
            : "Any printer that isn't a Billing Printer will be deactivated and its pending print jobs will fail. A currently-active billing printer stays online."
        }
        confirmLabel={`Switch to ${confirmingOperationType}`}
        onConfirm={changeOperationType}
      />
    </>
  );
}
