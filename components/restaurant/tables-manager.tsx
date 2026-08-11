"use client";

import { useState } from "react";
import { Check, Copy, Download, Plus, Printer, QrCode, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type TableRow = {
  id: string;
  label: string;
  code: string;
  seats: number | null;
  isActive: boolean;
};

function AddTablesDialog({
  onCreated,
  trigger,
}: {
  onCreated: (tables: TableRow[]) => void;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [label, setLabel] = useState("");
  const [prefix, setPrefix] = useState("Table");
  const [count, setCount] = useState("10");
  const [startAt, setStartAt] = useState("1");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload =
      mode === "single"
        ? { label }
        : { prefix, count: Number(count), startAt: Number(startAt) };

    setIsSaving(true);
    try {
      const res = await fetch("/api/restaurant/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not add tables");
        return;
      }
      toast.success(data.tables.length === 1 ? "Table added" : `${data.tables.length} tables added`);
      onCreated(data.tables);
      setLabel("");
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add tables</DialogTitle>
          <DialogDescription>
            Each table gets its own QR code linking to your menu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(["single", "bulk"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === value
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "single" ? "One table" : "Several at once"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "single" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="table-label">Table name</Label>
              <Input
                id="table-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Table 1"
                required
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="table-prefix">Name prefix</Label>
                <Input
                  id="table-prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="table-count">How many</Label>
                  <Input
                    id="table-count"
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="table-start">Start at</Label>
                  <Input
                    id="table-start"
                    type="number"
                    min={1}
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Creates {prefix} {startAt} … {prefix} {Number(startAt) + Number(count || 1) - 1}
              </p>
            </>
          )}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Adding…" : "Add"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The single code for take-away and delivery. It opens the table-less menu,
 * so unlike the table cards there is nothing here to retire or delete —
 * print it once for the counter or the shopfront window.
 */
function TakeawayQrCard({ orderUrl }: { orderUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(orderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-border/80 bg-muted/30">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-ink">
            <ShoppingBag className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">Take-away &amp; delivery</p>
            <p className="text-xs text-muted-foreground">
              One code for guests ordering without a table.
            </p>
          </div>
        </div>

        {showQr && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src="/api/restaurant/takeaway-qr"
            alt="QR code for take-away and delivery orders"
            className="mx-auto size-40 rounded-xl border border-border bg-white p-2"
          />
        )}

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="xs" onClick={() => setShowQr((v) => !v)}>
            <QrCode data-icon="inline-start" />
            {showQr ? "Hide QR" : "Show QR"}
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={copyUrl}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button
            variant="outline"
            size="xs"
            render={<a href="/api/restaurant/takeaway-qr" download="take-away-qr.png" />}
          >
            <Download data-icon="inline-start" />
            PNG
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TableCard({
  table,
  orderUrl,
  onDelete,
}: {
  table: TableRow;
  orderUrl: string;
  onDelete: (table: TableRow) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(orderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-border/80">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{table.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {table.seats ? `${table.seats} seats · ` : ""}
              <span className="font-mono">{table.code}</span>
            </p>
          </div>
          {!table.isActive && <Badge variant="secondary">Retired</Badge>}
        </div>

        {showQr && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/restaurant/tables/${table.id}/qr`}
            alt={`QR code for ${table.label}`}
            className="mx-auto size-40 rounded-xl border border-border bg-white p-2"
          />
        )}

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="xs" onClick={() => setShowQr((v) => !v)}>
            <QrCode data-icon="inline-start" />
            {showQr ? "Hide QR" : "Show QR"}
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={copyUrl}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button
            variant="outline"
            size="xs"
            render={
              <a
                href={`/api/restaurant/tables/${table.id}/qr`}
                download={`${table.label.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
              />
            }
          >
            <Download data-icon="inline-start" />
            PNG
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
            aria-label={`Remove ${table.label}`}
            onClick={() => onDelete(table)}
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function TablesManager({
  initialTables,
  restaurantSlug,
  baseUrl,
  offersTakeaway,
}: {
  initialTables: TableRow[];
  restaurantSlug: string;
  baseUrl: string;
  offersTakeaway: boolean;
}) {
  const [tables, setTables] = useState(initialTables);
  const [pendingDelete, setPendingDelete] = useState<TableRow | null>(null);

  async function confirmDeleteTable() {
    const table = pendingDelete;
    if (!table) return;
    setPendingDelete(null);

    const previous = tables;
    setTables((prev) => prev.filter((t) => t.id !== table.id));

    const res = await fetch(`/api/restaurant/tables/${table.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setTables(previous);
      toast.error("Could not remove table");
      return;
    }

    if (data.deactivated) {
      // The table had orders, so it was retired rather than deleted.
      setTables(previous.map((t) => (t.id === table.id ? { ...t, isActive: false } : t)));
      toast.success("Table retired — it has past orders, so its history is kept");
      return;
    }
    toast.success("Table removed");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        {(offersTakeaway || tables.some((t) => t.isActive)) && (
          <Button
            variant="outline"
            size="sm"
            render={<a href="/api/restaurant/tables/qr-sheet" target="_blank" rel="noreferrer" />}
          >
            <Printer data-icon="inline-start" />
            Print all QR codes
          </Button>
        )}
        <AddTablesDialog
          onCreated={(created) => setTables((prev) => [...prev, ...created])}
          trigger={
            <Button type="button" size="sm">
              <Plus /> Add tables
            </Button>
          }
        />
      </div>

      {offersTakeaway && <TakeawayQrCard orderUrl={`${baseUrl}/order/${restaurantSlug}`} />}

      {tables.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-ink">
              <QrCode className="size-6" />
            </span>
            <div>
              <p className="font-medium">No tables yet</p>
              <p className="text-sm text-muted-foreground">
                Add your tables and we&apos;ll generate a QR code for each one.
              </p>
            </div>
            <AddTablesDialog
              onCreated={(created) => setTables(created)}
              trigger={
                <Button type="button">
                  <Plus /> Add tables
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              orderUrl={`${baseUrl}/order/${restaurantSlug}/${table.code}`}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove table?"
        description={pendingDelete ? `"${pendingDelete.label}" will be removed.` : undefined}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={confirmDeleteTable}
      />
    </div>
  );
}
