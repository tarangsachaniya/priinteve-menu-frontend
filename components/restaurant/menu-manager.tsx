"use client";

import { useMemo, useState } from "react";
import { Clock, FolderPlus, Leaf, Pencil, Plus, Trash2, TrendingDown, UtensilsCrossed } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyLane, EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/format";
import { formatServeTime } from "@/lib/restaurant/menu-display";
import { categoryCreateSchema } from "@/lib/validations/restaurant";
import { MenuBulkImport } from "@/components/restaurant/menu-bulk-import";
import { MenuItemForm, type MenuItemRow } from "@/components/restaurant/menu-item-form";

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

function CategoryForm({
  onCreated,
  trigger,
}: {
  onCreated: (category: CategoryRow) => void;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = categoryCreateSchema.safeParse({ name, description });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the category name");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/restaurant/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not create category");
        return;
      }
      toast.success("Category added");
      onCreated(data.category);
      setName("");
      setDescription("");
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
          <DialogTitle>Add category</DialogTitle>
          <DialogDescription>
            Categories group your dishes — Starters, Main Course, Desserts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Starters"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-description">Description (optional)</Label>
            <Textarea
              id="category-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Adding…" : "Add category"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MenuManager({
  initialCategories,
  initialItems,
}: {
  initialCategories: CategoryRow[];
  initialItems: MenuItemRow[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<MenuItemRow | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<CategoryRow | null>(null);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name })),
    [categories]
  );

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MenuItemRow[]>();
    for (const category of categories) map.set(category.id, []);
    for (const item of items) {
      const list = map.get(item.categoryId);
      if (list) list.push(item);
    }
    return map;
  }, [categories, items]);

  function upsertItem(item: MenuItemRow) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      return exists ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item];
    });
  }

  function handleImported(newCategories: CategoryRow[], newItems: MenuItemRow[]) {
    if (newCategories.length > 0) setCategories((prev) => [...prev, ...newCategories]);
    if (newItems.length > 0) setItems((prev) => [...prev, ...newItems]);
  }

  async function toggleAvailable(item: MenuItemRow) {
    const previous = items;
    const nextAvailable = !item.isAvailable;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: nextAvailable } : i))
    );

    const res = await fetch(`/api/restaurant/menu-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: nextAvailable }),
    });
    if (!res.ok) {
      setItems(previous);
      toast.error("Could not update availability");
    }
  }

  async function confirmDeleteItem() {
    const item = pendingDeleteItem;
    if (!item) return;
    setPendingDeleteItem(null);

    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    const res = await fetch(`/api/restaurant/menu-items/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(previous);
      toast.error("Could not delete item");
      return;
    }
    toast.success("Item deleted");
  }

  function requestDeleteCategory(category: CategoryRow) {
    const count = itemsByCategory.get(category.id)?.length ?? 0;
    if (count > 0) {
      toast.error("Move or delete this category's items first");
      return;
    }
    setPendingDeleteCategory(category);
  }

  async function confirmDeleteCategory() {
    const category = pendingDeleteCategory;
    if (!category) return;
    setPendingDeleteCategory(null);

    const previous = categories;
    setCategories((prev) => prev.filter((c) => c.id !== category.id));

    const res = await fetch(`/api/restaurant/categories/${category.id}`, { method: "DELETE" });
    if (!res.ok) {
      setCategories(previous);
      toast.error("Could not delete category");
      return;
    }
    toast.success("Category deleted");
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Your menu is empty"
        description="Start with a category like Starters or Main Course."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <CategoryForm
              onCreated={(category) => setCategories([category])}
              trigger={
                <Button type="button">
                  <FolderPlus /> Add your first category
                </Button>
              }
            />
            <MenuBulkImport onImported={handleImported} />
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <MenuBulkImport onImported={handleImported} />
        <CategoryForm
          onCreated={(category) => setCategories((prev) => [...prev, category])}
          trigger={
            <Button type="button" variant="outline" size="sm">
              <FolderPlus /> Add category
            </Button>
          }
        />
        <MenuItemForm
          categories={categoryOptions}
          defaultCategoryId={categories[0].id}
          onSaved={upsertItem}
          trigger={
            <Button type="button" size="sm">
              <Plus /> Add item
            </Button>
          }
        />
      </div>

      {categories.map((category) => {
        const categoryItems = itemsByCategory.get(category.id) ?? [];

        return (
          <section key={category.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  {category.name}
                  <Badge variant="secondary">{categoryItems.length}</Badge>
                </h2>
                {category.description && (
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <MenuItemForm
                  categories={categoryOptions}
                  defaultCategoryId={category.id}
                  onSaved={upsertItem}
                  trigger={
                    <Button type="button" variant="ghost" size="xs">
                      <Plus /> Item
                    </Button>
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => requestDeleteCategory(category)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            {categoryItems.length === 0 ? (
              <EmptyLane>No items in this category yet.</EmptyLane>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {categoryItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden border-border/80">
                    <CardContent className="flex gap-3 p-3">
                      {item.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="size-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <UtensilsCrossed className="size-5" />
                        </div>
                      )}

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium">
                              {item.isVeg && <Leaf className="size-3.5 shrink-0 text-emerald-600" />}
                              {item.name}
                            </p>
                            <p className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                              {formatCurrency(item.price)}
                              {formatServeTime(item.prepMinutes) && (
                                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                                  <Clock className="size-3" />
                                  {formatServeTime(item.prepMinutes)}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <MenuItemForm
                              item={item}
                              categories={categoryOptions}
                              defaultCategoryId={item.categoryId}
                              onSaved={upsertItem}
                              trigger={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Edit ${item.name}`}
                                >
                                  <Pencil />
                                </Button>
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Delete ${item.name}`}
                              onClick={() => setPendingDeleteItem(item)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>

                        {item.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        )}

                        <div className="mt-auto flex items-center gap-2 pt-1">
                          <Switch
                            checked={item.isAvailable}
                            onCheckedChange={() => toggleAvailable(item)}
                            aria-label={`Toggle availability for ${item.name}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.isAvailable ? "Available" : "Out of stock"}
                          </span>
                          {/* Only ever shown when set. A row of "not hidden"
                              badges across an entire menu would say nothing. */}
                          {item.demoteAtPeak && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <TrendingDown className="size-3" />
                              Hidden during rush
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <ConfirmDialog
        open={pendingDeleteItem !== null}
        onOpenChange={(open) => !open && setPendingDeleteItem(null)}
        title="Delete item?"
        description={
          pendingDeleteItem
            ? `"${pendingDeleteItem.name}" will be removed from the menu.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteItem}
      />
      <ConfirmDialog
        open={pendingDeleteCategory !== null}
        onOpenChange={(open) => !open && setPendingDeleteCategory(null)}
        title="Delete category?"
        description={
          pendingDeleteCategory
            ? `The "${pendingDeleteCategory.name}" category will be removed.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteCategory}
      />
    </div>
  );
}
