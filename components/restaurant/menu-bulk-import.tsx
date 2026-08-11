"use client";

import { useState } from "react";
import { FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { menuBulkImportSchema } from "@/lib/validations/restaurant";
import type { CategoryRow } from "@/components/restaurant/menu-manager";
import type { MenuItemRow } from "@/components/restaurant/menu-item-form";

const EXAMPLE = {
  categories: [
    {
      name: "Starters",
      items: [
        {
          name: "Veg Spring Rolls",
          description: "Cottage cheese in a rich tomato and butter gravy",
          price: 180,
          isVeg: true,
          prepMinutes: 15,
        },
        {
          name: "Chicken Tikka",
          price: 260,
          isVeg: false,
          badge: "BESTSELLER",
          prepMinutes: 35,
          demoteAtPeak: true,
          variants: [
            { name: "Half", priceDelta: -60 },
            { name: "Full", priceDelta: 0, isDefault: true },
          ],
          addOns: [{ name: "Extra mint chutney", price: 20 }],
        },
      ],
    },
  ],
};

type SkippedItem = { category: string; item: string; reason: string };
type AugmentedItem = { category: string; item: string; variantsAdded: number; addOnsAdded: number };

/**
 * Paste-a-JSON-document path onto the menu.
 *
 * This is also, today, the only way to set a variant or an add-on at all —
 * the schema and the customer order flow have supported both since the
 * template was built, but no one-item-at-a-time screen for them exists yet.
 * A restaurant with a "Half / Full" size or an optional extra has to come
 * through here until that screen is built.
 *
 * Re-running the same document is expected and safe: a category is matched
 * by name rather than duplicated, and an item already in that category (by
 * name) is skipped rather than created again. Nothing is ever updated by this
 * screen — a skip is the only way past data survives a re-paste.
 */
export function MenuBulkImport({
  onImported,
}: {
  onImported: (categories: CategoryRow[], items: MenuItemRow[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [skipped, setSkipped] = useState<SkippedItem[] | null>(null);
  const [augmented, setAugmented] = useState<AugmentedItem[] | null>(null);

  function loadExample() {
    setText(JSON.stringify(EXAMPLE, null, 2));
    setSkipped(null);
    setAugmented(null);
  }

  async function handleImport() {
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      toast.error("That isn't valid JSON — check for a missing comma or bracket");
      return;
    }

    const parsed = menuBulkImportSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.join(".");
      toast.error(path ? `${issue.message} (at ${path})` : issue?.message ?? "Check the JSON shape");
      return;
    }

    setIsSaving(true);
    setSkipped(null);
    setAugmented(null);
    try {
      const res = await fetch("/api/restaurant/menu-items/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Import failed");
        return;
      }

      const { categoriesCreated, itemsCreated, itemsAugmented, itemsSkipped } = data.summary;
      onImported(data.categories, data.items);

      const optionsAdded = (data.augmented as AugmentedItem[]).reduce(
        (sum, a) => sum + a.variantsAdded + a.addOnsAdded,
        0
      );

      if (itemsCreated === 0 && itemsAugmented === 0) {
        toast.info("Nothing new — every item and option in this document already exists");
      } else {
        const parts = [
          itemsCreated > 0 && `added ${itemsCreated} item${itemsCreated === 1 ? "" : "s"}`,
          categoriesCreated > 0 &&
            `${categoriesCreated} new categor${categoriesCreated === 1 ? "y" : "ies"}`,
          itemsAugmented > 0 &&
            `added ${optionsAdded} option${optionsAdded === 1 ? "" : "s"} to ${itemsAugmented} existing item${itemsAugmented === 1 ? "" : "s"}`,
          itemsSkipped > 0 && `skipped ${itemsSkipped} unchanged`,
        ].filter(Boolean);
        toast.success(parts.join(" · "));
      }

      if (itemsSkipped > 0 || itemsAugmented > 0) {
        setSkipped(data.skipped);
        setAugmented(data.augmented);
      } else {
        setText("");
        setOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setText("");
          setSkipped(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <FileJson /> Bulk import
          </Button>
        }
      />
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk import menu</DialogTitle>
          <DialogDescription>
            Paste a JSON document to add several categories and dishes at once — including sizes
            and add-ons, which don&apos;t have a one-at-a-time screen yet. Safe to paste again: an
            existing category is reused, an item already on the menu is never duplicated or
            edited, and if it&apos;s missing a size or add-on from the document, that one option is
            added onto it.
          </DialogDescription>
        </DialogHeader>

        {/* Two columns rather than one tall stack: a real menu's worth of
            JSON plus the results panels below it made this dialog taller
            than most laptop screens, forcing the page to scroll to reach the
            Import button. Side by side, both fit without any scrollbar. */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Paste JSON</Label>
              <Button type="button" variant="ghost" size="xs" onClick={loadExample}>
                Load example
              </Button>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={16}
              placeholder='{\n  "categories": [\n    { "name": "Starters", "items": [ { "name": "Spring Rolls", "price": 180 } ] }\n  ]\n}'
              className="scrollbar-none flex-1 resize-none font-mono text-xs"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Shape</p>
              <pre className="mt-1 whitespace-pre-wrap font-mono">
                {"{ categories: [{ name, description?, items: [...] }] }"}
              </pre>
              <p className="mt-2 font-medium text-foreground">Per item</p>
              <p className="mt-1">
                name, price, description?, isVeg?, isAvailable?, imageUrl?, badge?, prepMinutes?,
                demoteAtPeak?, variants?, addOns?
              </p>
              <p className="mt-2">
                <span className="font-medium text-foreground">prepMinutes</span> is the approximate
                serve time in minutes.{" "}
                <span className="font-medium text-foreground">demoteAtPeak</span> moves the dish to
                the last page of your menu during rush hours.
              </p>
            </div>

            {augmented && augmented.length > 0 && (
              <div className="flex flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                <p className="font-medium">Added options to existing items:</p>
                <ul className="max-h-32 list-inside list-disc overflow-y-auto">
                  {augmented.map((a, i) => (
                    <li key={i}>
                      {a.item} <span className="opacity-70">({a.category})</span> —{" "}
                      {[
                        a.variantsAdded > 0 && `${a.variantsAdded} size${a.variantsAdded === 1 ? "" : "s"}`,
                        a.addOnsAdded > 0 && `${a.addOnsAdded} add-on${a.addOnsAdded === 1 ? "" : "s"}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {skipped && skipped.length > 0 && (
              <div className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                <p className="font-medium">Skipped — already on the menu with the same options:</p>
                <ul className="max-h-32 list-inside list-disc overflow-y-auto">
                  {skipped.map((s, i) => (
                    <li key={i}>
                      {s.item} <span className="opacity-70">({s.category})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <Button type="button" onClick={handleImport} disabled={isSaving || !text.trim()}>
          {isSaving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {isSaving ? "Importing…" : "Import"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
