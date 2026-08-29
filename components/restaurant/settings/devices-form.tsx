"use client";

import { useState } from "react";
import { ChefHat, Laptop, Monitor, Printer, RefreshCw, Smartphone, Trash2, Tv } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";

// PRINTER_BRIDGE pairs through this exact same code-entry flow as a TV — a
// local software service (not a screen) that relays print jobs to the
// restaurant's physical printers. This form doesn't pair one differently; it
// just needs to recognize the kind so a paired bridge renders sanely in the
// list below instead of falling through to an undefined label/icon.
type DeviceKind = "TV_KITCHEN" | "TV_PICKUP" | "MOBILE" | "PRINTER_BRIDGE" | "DESKTOP";

type Device = {
  id: string;
  kind: DeviceKind;
  name: string;
  platform: string | null;
  // Only ever set for PRINTER_BRIDGE today — every other kind sends no
  // X-Bridge-Version header, so this stays null for them.
  appVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

const KIND_LABEL: Record<DeviceKind, string> = {
  TV_KITCHEN: "Kitchen TV",
  TV_PICKUP: "Pickup TV",
  MOBILE: "Mobile app",
  PRINTER_BRIDGE: "Printer bridge",
  DESKTOP: "Desktop app",
};

const KIND_ICON: Record<DeviceKind, typeof ChefHat> = {
  TV_KITCHEN: ChefHat,
  TV_PICKUP: Monitor,
  MOBILE: Smartphone,
  PRINTER_BRIDGE: Printer,
  DESKTOP: Laptop,
};

/**
 * A TV never talks to this page — it only polls GET /api/device/pair/:id/status
 * and turns CONFIRMED into a real session itself via POST /api/device/pair/exchange.
 * This form's whole job is the one action that flips a pairing to CONFIRMED:
 * typing (or scanning in, via ?pair=) the code the TV is showing.
 *
 * The list below doesn't gain the newly-paired device the instant this form
 * confirms a code — that row only exists once the TV completes its own
 * exchange a few seconds later — so "Refresh" is a manual re-fetch rather
 * than a promise this page can keep on its own.
 */
export function DevicesForm({
  initialDevices,
  initialCode,
}: {
  initialDevices: Device[];
  initialCode?: string;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [code, setCode] = useState(initialCode ?? "");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState<Device | null>(null);

  async function confirmPairing() {
    // Case is significant — never normalized. Only whitespace and a display
    // dash (e.g. "xy7k-2qrs") are stripped, since neither is ever part of the
    // code's own alphabet and copying one in shouldn't break the match.
    const normalized = code.trim().replace(/[\s-]/g, "");
    if (!normalized || !deviceName.trim()) return;

    setBusy(true);
    try {
      const res = await fetch("/api/restaurant/devices/confirm-pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized, deviceName: deviceName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        toast.error(
          typeof data.error === "string" ? data.error : "That code didn't match — check the TV and try again.",
        );
        return;
      }
      setCode("");
      setDeviceName("");
      toast.success("Code confirmed — the TV should sign in within a few seconds.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/restaurant/devices");
      const data = (await res.json().catch(() => ({}))) as { devices?: Device[] };
      if (res.ok && data.devices) setDevices(data.devices);
    } finally {
      setRefreshing(false);
    }
  }

  async function revoke(device: Device) {
    setRevoking(null);
    const res = await fetch(`/api/restaurant/devices/${device.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not sign this device out");
      return;
    }
    setDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, revokedAt: new Date().toISOString() } : d)),
    );
    toast.success(`${device.name} signed out`);
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-2.5">
            <Label htmlFor="pairing-code" className="flex items-center gap-1.5">
              <Tv className="size-4" />
              Pair a TV
            </Label>
            <p className="text-xs text-muted-foreground">
              On the TV, open the Priinteve app and pick Kitchen Display or Pickup Board —
              it&apos;ll show a short code. Type that code below (or scan its QR code, which
              brings you straight here with the code filled in).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pairing-code" className="sr-only">
                  Code from the TV
                </Label>
                <Input
                  id="pairing-code"
                  autoComplete="off"
                  placeholder="Code from the TV"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-40 font-mono tracking-widest"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="device-name" className="sr-only">
                  Name this device
                </Label>
                <Input
                  id="device-name"
                  autoComplete="off"
                  maxLength={60}
                  placeholder="Name this device, e.g. Front counter TV"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-64"
                />
              </div>
              <Button
                type="button"
                onClick={() => void confirmPairing()}
                disabled={busy || !code.trim() || !deviceName.trim()}
              >
                Confirm
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <Label>Paired devices</Label>
              <Button type="button" variant="ghost" size="sm" disabled={refreshing} onClick={() => void refresh()}>
                <RefreshCw data-icon="inline-start" className={refreshing ? "animate-spin" : undefined} />
                Refresh
              </Button>
            </div>

            {devices.length === 0 ? (
              <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                No TVs or mobile apps paired yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {devices.map((device) => (
                  <DeviceRow key={device.id} device={device} onRevoke={() => setRevoking(device)} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        variant="destructive"
        title={`Sign out ${revoking?.name ?? "this device"}?`}
        description="It stops working immediately — a TV goes back to its pairing screen, a phone is signed out on its next request."
        confirmLabel="Sign out"
        onConfirm={() => revoking && void revoke(revoking)}
      />
    </>
  );
}

function DeviceRow({ device, onRevoke }: { device: Device; onRevoke: () => void }) {
  const Icon = KIND_ICON[device.kind];
  const revoked = device.revokedAt !== null;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{device.name}</p>
        <p className="text-xs text-muted-foreground">
          {KIND_LABEL[device.kind]}
          {device.appVersion ? ` · v${device.appVersion}` : ""}
          {revoked
            ? " · Signed out"
            : device.lastSeenAt
              ? ` · Last seen ${formatDateTime(device.lastSeenAt)}`
              : " · Never connected"}
        </p>
      </div>
      {!revoked && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Sign out ${device.name}`} onClick={onRevoke}>
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
