"use client";

import { useState } from "react";
import { Info, Plus, Table2, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Tables, as a restaurant manages them.
 *
 * Note what is NOT here any more: the QR image, the PNG download, the copy-link
 * button, the print sheet, and the table `code` itself. Priinteve Innovations produces the
 * physical QR Menu Card, so the restaurant's job ends at telling us what its
 * tables are called.
 *
 * This is presentation only. The API does not send a restaurant session the
 * code or the URL at all (see the API's routes/restaurant/tables.routes.ts), so
 * removing these controls hides nothing that a devtools request could recover
 * — TableRow below has no `code` field because the response has no `code`
 * field.
 */

export type TableRow = {
  id: string;
  label: string;
  seats: number | null;
  isActive: boolean;
};

/** What the owner is told to do next, in the one place they'd look for a QR. */
const PRINTEVE_NOTICE =
  "Contact Priinteve Innovations to get your printed QR Menu Card. We generate and print the code for each table and send it to you.";

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

      // The success message carries the next step, because there is no longer
      // a QR button on the new card to imply one.
      toast.success(
        data.tables.length === 1
          ? "Table created successfully."
          : `${data.tables.length} tables created successfully.`,
        { description: PRINTEVE_NOTICE, duration: 8000 },
      );
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
            Name your tables here. Priinteve Innovations prints a QR Menu Card for each one.
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

function TableCard({ table, onDelete }: { table: TableRow; onDelete: (table: TableRow) => void }) {
  return (
    <Card className="border-border/80">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-ink">
            <Table2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{table.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {table.seats ? `${table.seats} seats` : "Seats not set"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!table.isActive && <Badge variant="secondary">Retired</Badge>}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
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

export function TablesManager({ initialTables }: { initialTables: TableRow[] }) {
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
      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-ink" />
          <div className="text-sm">
            <p className="font-medium">QR Menu Cards are printed by Priinteve Innovations</p>
            <p className="mt-0.5 text-muted-foreground">
              Add your tables here, then contact Priinteve Innovations — we generate and print the QR Menu Card
              for each table and send them to you.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <AddTablesDialog
          onCreated={(created) => setTables((prev) => [...prev, ...created])}
          trigger={
            <Button type="button" size="sm">
              <Plus /> Add tables
            </Button>
          }
        />
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="No tables yet"
          description="Add your tables and contact Priinteve Innovations for your printed QR Menu Cards."
          action={
            <AddTablesDialog
              onCreated={(created) => setTables(created)}
              trigger={
                <Button type="button">
                  <Plus /> Add tables
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => (
            <TableCard key={table.id} table={table} onDelete={setPendingDelete} />
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
