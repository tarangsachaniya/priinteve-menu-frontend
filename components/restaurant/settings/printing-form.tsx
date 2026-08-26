"use client";

import { useState } from "react";
import { ChefHat, Printer as PrinterIcon, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  RestoKotPrinterMode,
  RestoOperationType,
  RestoPrinterConnectionType,
  RestoPrinterPaperWidth,
  RestoPrinterRole,
  RestoPrintJobType,
} from "@/lib/api/enums";
import { printerInvariantIssue } from "@/lib/validations/restaurant";

export type Printer = {
  id: string;
  restaurantId: string;
  name: string;
  role: RestoPrinterRole;
  connectionType: RestoPrinterConnectionType;
  ipAddress: string | null;
  port: number | null;
  usbIdentifier: string | null;
  paperWidth: RestoPrinterPaperWidth;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Same response shape as the admin operation-type endpoint — switching
 * printer mode can also deactivate now-illegal printers. */
type PrinterModeChangeResult = {
  restaurant: { operationType: RestoOperationType; kotPrinterMode: RestoKotPrinterMode | null };
  deactivatedPrinters: { id: string; name: string; role: RestoPrinterRole }[];
  failedJobCount: number;
};

const CONNECTION_LABEL: Record<RestoPrinterConnectionType, string> = {
  LAN: "Network (LAN)",
  USB: "USB",
  BLUETOOTH: "Bluetooth",
};

const CONNECTION_TYPES: RestoPrinterConnectionType[] = ["LAN", "USB", "BLUETOOTH"];

const PAPER_LABEL: Record<RestoPrinterPaperWidth, string> = {
  MM_58: "58mm",
  MM_80: "80mm",
};

const PAPER_WIDTHS: RestoPrinterPaperWidth[] = ["MM_58", "MM_80"];

const MODE_LABEL: Record<RestoKotPrinterMode, string> = {
  ONE_WAY: "One-Way",
  TWO_WAY: "Two-Way",
};

/**
 * The restaurant's own Printing settings page.
 *
 * What it shows depends entirely on operationType/kotPrinterMode, both
 * read-only here except kotPrinterMode itself (the one thing a KOT
 * restaurant configures about its own printing). See the page's own comment
 * for the four shapes this can render.
 */
export function PrintingForm({
  operationType,
  initialKotPrinterMode,
  initialPrinters,
}: {
  operationType: RestoOperationType;
  initialKotPrinterMode: RestoKotPrinterMode | null;
  initialPrinters: Printer[];
}) {
  const [kotPrinterMode, setKotPrinterMode] = useState(initialKotPrinterMode);
  const [printers, setPrinters] = useState(initialPrinters);
  const [confirmingMode, setConfirmingMode] = useState<RestoKotPrinterMode | null>(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  function activePrinter(role: RestoPrinterRole): Printer | undefined {
    // GET /api/restaurant/printers includes inactive/historical rows too —
    // only an active one counts as "the current printer" for a role.
    return printers.find((p) => p.role === role && p.active);
  }

  async function applyPrinterMode(mode: RestoKotPrinterMode) {
    setIsSwitchingMode(true);
    try {
      const res = await fetch("/api/restaurant/settings/printer-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kotPrinterMode: mode }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<PrinterModeChangeResult> & {
        error?: unknown;
      };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not change the printer mode");
        return;
      }

      setKotPrinterMode(data.restaurant?.kotPrinterMode ?? mode);
      const deactivatedIds = new Set((data.deactivatedPrinters ?? []).map((p) => p.id));
      if (deactivatedIds.size > 0) {
        setPrinters((prev) => prev.map((p) => (deactivatedIds.has(p.id) ? { ...p, active: false } : p)));
      }

      const deactivated = data.deactivatedPrinters?.length ?? 0;
      const failedJobs = data.failedJobCount ?? 0;
      toast.success(
        deactivated > 0 || failedJobs > 0
          ? `Switched to ${MODE_LABEL[mode]}. Deactivated ${deactivated} printer${deactivated === 1 ? "" : "s"}, failed ${failedJobs} pending print job${failedJobs === 1 ? "" : "s"}.`
          : `Switched to ${MODE_LABEL[mode]} printing`,
      );
    } finally {
      setIsSwitchingMode(false);
    }
  }

  function chooseMode(mode: RestoKotPrinterMode) {
    // The very first choice is free — no printer exists yet, so nothing can
    // be deactivated. Changing an already-chosen mode can deactivate
    // now-illegal printers, so that path confirms first.
    if (kotPrinterMode === null) {
      void applyPrinterMode(mode);
    } else if (mode !== kotPrinterMode) {
      setConfirmingMode(mode);
    }
  }

  function upsertPrinter(printer: Printer) {
    setPrinters((prev) => [...prev.filter((p) => p.id !== printer.id), printer]);
  }

  function deactivateLocally(id: string) {
    setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, active: false } : p)));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/80">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">
              Operation type:{" "}
              <Badge variant={operationType === "KOT" ? "default" : "secondary"}>{operationType}</Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              Managed by Administrator — this controls your billing/printing architecture and can
              only be changed by your Priinteve administrator.
            </p>
          </div>
          {operationType === "KOT" && kotPrinterMode !== null && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Printer mode: <span className="font-medium text-foreground">{MODE_LABEL[kotPrinterMode]}</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={isSwitchingMode}
                onClick={() => chooseMode(kotPrinterMode === "ONE_WAY" ? "TWO_WAY" : "ONE_WAY")}
              >
                Switch to {kotPrinterMode === "ONE_WAY" ? "Two-Way" : "One-Way"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {operationType === "KOT" && kotPrinterMode === null && (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Choose your printer mode</CardTitle>
            <CardDescription>
              One-Way uses a single shared printer for both the bill and the kitchen ticket.
              Two-Way uses two separate printers — one for billing, one for the kitchen. Pick
              whichever matches your counter, then set the printer(s) up below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button type="button" disabled={isSwitchingMode} onClick={() => chooseMode("ONE_WAY")}>
              One-Way — one shared printer
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSwitchingMode}
              onClick={() => chooseMode("TWO_WAY")}
            >
              Two-Way — separate billing &amp; kitchen
            </Button>
          </CardContent>
        </Card>
      )}

      {operationType === "KOT" && kotPrinterMode === "ONE_WAY" && (
        <PrinterCard
          role="SHARED"
          title="Shared printer"
          description="Prints both the guest bill and the kitchen order ticket."
          printer={activePrinter("SHARED")}
          testTypes={["BILL", "KOT"]}
          onSaved={upsertPrinter}
          onDeactivated={deactivateLocally}
        />
      )}

      {operationType === "KOT" && kotPrinterMode === "TWO_WAY" && (
        <>
          <PrinterCard
            role="BILLING"
            title="Billing printer"
            description="Prints the guest bill."
            printer={activePrinter("BILLING")}
            testTypes={["BILL"]}
            onSaved={upsertPrinter}
            onDeactivated={deactivateLocally}
          />
          <PrinterCard
            role="KITCHEN"
            title="Kitchen printer"
            description="Prints the kitchen order ticket."
            printer={activePrinter("KITCHEN")}
            testTypes={["KOT"]}
            onSaved={upsertPrinter}
            onDeactivated={deactivateLocally}
          />
        </>
      )}

      {operationType === "DBS" && (
        <PrinterCard
          role="BILLING"
          title="Billing printer"
          description="DBS restaurants support exactly one billing printer."
          printer={activePrinter("BILLING")}
          testTypes={["BILL"]}
          onSaved={upsertPrinter}
          onDeactivated={deactivateLocally}
        />
      )}

      <ConfirmDialog
        open={confirmingMode !== null}
        onOpenChange={(open) => !open && setConfirmingMode(null)}
        variant="destructive"
        title={`Switch to ${confirmingMode ? MODE_LABEL[confirmingMode] : ""} printing?`}
        description="Any printer that isn't legal under the new mode will be deactivated, and its pending print jobs will fail. You'll need to add printers again for the new mode."
        confirmLabel="Switch"
        onConfirm={() => confirmingMode && void applyPrinterMode(confirmingMode)}
      />
    </div>
  );
}

const EMPTY_PRINTER_FORM = {
  name: "",
  connectionType: "LAN" as RestoPrinterConnectionType,
  ipAddress: "",
  port: "",
  usbIdentifier: "",
  paperWidth: "MM_80" as RestoPrinterPaperWidth,
};

/**
 * One role's printer card — either an inline "add" form (no active printer
 * for this role yet) or the active printer's edit form, delete control and
 * legal test-print buttons for its role.
 */
function PrinterCard({
  role,
  title,
  description,
  printer,
  testTypes,
  onSaved,
  onDeactivated,
}: {
  role: RestoPrinterRole;
  title: string;
  description: string;
  printer: Printer | undefined;
  /** Which test-print buttons are legal for this role — BILLING only ever
   * gets BILL, KITCHEN only ever gets KOT, SHARED gets both. */
  testTypes: RestoPrintJobType[];
  onSaved: (printer: Printer) => void;
  onDeactivated: (id: string) => void;
}) {
  const [form, setForm] = useState(() =>
    printer
      ? {
          name: printer.name,
          connectionType: printer.connectionType,
          ipAddress: printer.ipAddress ?? "",
          port: printer.port ? String(printer.port) : "",
          usbIdentifier: printer.usbIdentifier ?? "",
          paperWidth: printer.paperWidth,
        }
      : EMPTY_PRINTER_FORM,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [testing, setTesting] = useState<RestoPrintJobType | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    const invariant = printerInvariantIssue({
      connectionType: form.connectionType,
      ipAddress: form.ipAddress || null,
      port: form.port ? Number(form.port) : null,
      usbIdentifier: form.usbIdentifier || null,
    });
    if (invariant) {
      toast.error(invariant.message);
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        connectionType: form.connectionType,
        ipAddress: form.connectionType === "LAN" ? form.ipAddress.trim() : null,
        port: form.connectionType === "LAN" ? Number(form.port) : null,
        usbIdentifier: form.connectionType !== "LAN" ? form.usbIdentifier.trim() : null,
        paperWidth: form.paperWidth,
      };
      const res = await fetch(
        printer ? `/api/restaurant/printers/${printer.id}` : "/api/restaurant/printers",
        {
          method: printer ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(printer ? body : { ...body, role }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save the printer");
        return;
      }
      onSaved(data.printer);
      toast.success(printer ? "Printer updated" : "Printer added");
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivate() {
    setConfirmingDelete(false);
    if (!printer) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/restaurant/printers/${printer.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not remove this printer");
        return;
      }
      onDeactivated(printer.id);
      setForm(EMPTY_PRINTER_FORM);
      toast.success("Printer removed");
    } finally {
      setIsDeleting(false);
    }
  }

  async function testPrint(type: RestoPrintJobType) {
    if (!printer) return;
    setTesting(type);
    try {
      const res = await fetch(`/api/restaurant/printers/${printer.id}/test-print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not queue the test print");
        return;
      }
      toast.success(`Test ${type === "BILL" ? "bill" : "kitchen ticket"} queued`);
    } finally {
      setTesting(null);
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <PrinterIcon className="size-4" />
            {title}
          </span>
          {printer && <Badge variant="default">Active</Badge>}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!printer && (
          <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            No printer configured for this role yet — add one below.
          </p>
        )}

        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${role}-name`}>Name</Label>
              <Input
                id={`${role}-name`}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Front counter printer"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Connection</Label>
              <Select
                value={form.connectionType}
                onValueChange={(v) => v && update("connectionType", v as RestoPrinterConnectionType)}
                items={CONNECTION_TYPES.map((v) => ({ value: v, label: CONNECTION_LABEL[v] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONNECTION_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {CONNECTION_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.connectionType === "LAN" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${role}-ip`}>IP address</Label>
                <Input
                  id={`${role}-ip`}
                  value={form.ipAddress}
                  onChange={(e) => update("ipAddress", e.target.value)}
                  placeholder="192.168.1.50"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${role}-port`}>Port</Label>
                <Input
                  id={`${role}-port`}
                  type="number"
                  inputMode="numeric"
                  value={form.port}
                  onChange={(e) => update("port", e.target.value)}
                  placeholder="9100"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${role}-usb`}>
                {form.connectionType === "USB" ? "Device identifier" : "Paired Bluetooth device"}
              </Label>
              <Input
                id={`${role}-usb`}
                value={form.usbIdentifier}
                onChange={(e) => update("usbIdentifier", e.target.value)}
                placeholder={form.connectionType === "USB" ? "USB001" : "Name of the paired printer"}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5 sm:w-48">
            <Label>Paper width</Label>
            <Select
              value={form.paperWidth}
              onValueChange={(v) => v && update("paperWidth", v as RestoPrinterPaperWidth)}
              items={PAPER_WIDTHS.map((v) => ({ value: v, label: PAPER_LABEL[v] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_WIDTHS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {PAPER_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Saving…" : printer ? "Save changes" : "Add printer"}
            </Button>
            {printer && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 data-icon="inline-start" />
                Remove
              </Button>
            )}
          </div>
        </form>

        {printer && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {testTypes.includes("BILL") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testing !== null}
                onClick={() => void testPrint("BILL")}
              >
                <Receipt data-icon="inline-start" />
                {testing === "BILL" ? "Queuing…" : "Test Bill"}
              </Button>
            )}
            {testTypes.includes("KOT") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testing !== null}
                onClick={() => void testPrint("KOT")}
              >
                <ChefHat data-icon="inline-start" />
                {testing === "KOT" ? "Queuing…" : "Test Kitchen Token"}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        variant="destructive"
        title={`Remove ${printer?.name ?? "this printer"}?`}
        description="This frees up the role for a new printer. Any pending print jobs on it will fail."
        confirmLabel="Remove"
        onConfirm={() => void deactivate()}
      />
    </Card>
  );
}
