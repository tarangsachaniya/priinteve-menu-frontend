"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { menuItemCreateSchema } from "@/lib/validations/restaurant";

/** A size choice — "Half" / "Full". `priceDelta` adjusts the base price. */
export type VariantRow = { id?: string; name: string; priceDelta: number; isDefault: boolean };
/** An optional extra, priced on its own rather than as a delta. */
export type AddOnRow = { id?: string; name: string; price: number };

export type MenuItemRow = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  imagePublicId: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  badge: string | null;
  /** Approximate minutes to plate. Null means the owner hasn't quoted one. */
  prepMinutes: number | null;
  demoteAtPeak: boolean;
  sortOrder: number;
  variants: VariantRow[];
  addOns: AddOnRow[];
};

export type CategoryOption = { id: string; name: string };

/** Row shapes while being edited — numbers stay strings so a field can be
 * emptied mid-edit without snapping to 0, matching how the top-level price
 * input already behaves. Converted back to numbers by the schema's coercion
 * at submit time. */
type VariantFormRow = { id?: string; name: string; priceDelta: string; isDefault: boolean };
type AddOnFormRow = { id?: string; name: string; price: string };

type ItemFormState = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  isVeg: boolean;
  isAvailable: boolean;
  /** String for the same reason price is — an emptied field must not snap to 0. */
  prepMinutes: string;
  demoteAtPeak: boolean;
  imageUrl: string;
  imagePublicId: string;
  variants: VariantFormRow[];
  addOns: AddOnFormRow[];
};

function toFormState(item: MenuItemRow | undefined, defaultCategoryId: string): ItemFormState {
  return {
    categoryId: item?.categoryId ?? defaultCategoryId,
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item ? String(item.price) : "",
    isVeg: item?.isVeg ?? true,
    isAvailable: item?.isAvailable ?? true,
    prepMinutes: item?.prepMinutes == null ? "" : String(item.prepMinutes),
    demoteAtPeak: item?.demoteAtPeak ?? false,
    imageUrl: item?.imageUrl ?? "",
    imagePublicId: item?.imagePublicId ?? "",
    variants: (item?.variants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      priceDelta: String(v.priceDelta),
      isDefault: v.isDefault,
    })),
    addOns: (item?.addOns ?? []).map((a) => ({ id: a.id, name: a.name, price: String(a.price) })),
  };
}

export function MenuItemForm({
  item,
  categories,
  defaultCategoryId,
  onSaved,
  trigger,
}: {
  item?: MenuItemRow;
  categories: CategoryOption[];
  defaultCategoryId: string;
  onSaved: (item: MenuItemRow) => void;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toFormState(item, defaultCategoryId));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(item);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addVariant() {
    setForm((prev) => ({
      ...prev,
      // The first size added defaults to selected — an item with sizes and
      // no default is one the cart can't preselect anything for.
      variants: [...prev.variants, { name: "", priceDelta: "0", isDefault: prev.variants.length === 0 }],
    }));
  }
  function updateVariant(index: number, patch: Partial<VariantFormRow>) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  }
  function setDefaultVariant(index: number) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => ({ ...v, isDefault: i === index })),
    }));
  }
  function removeVariant(index: number) {
    setForm((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  }

  function addAddOn() {
    setForm((prev) => ({ ...prev, addOns: [...prev.addOns, { name: "", price: "0" }] }));
  }
  function updateAddOn(index: number, patch: Partial<AddOnFormRow>) {
    setForm((prev) => ({
      ...prev,
      addOns: prev.addOns.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  }
  function removeAddOn(index: number) {
    setForm((prev) => ({ ...prev, addOns: prev.addOns.filter((_, i) => i !== index) }));
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/restaurant/menu-items/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      setForm((prev) => ({
        ...prev,
        imageUrl: data.imageUrl,
        imagePublicId: data.imagePublicId,
      }));
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = menuItemCreateSchema.safeParse({ ...form, price: form.price });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the item details");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/restaurant/menu-items/${item!.id}` : "/api/restaurant/menu-items",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save item");
        return;
      }
      toast.success(isEdit ? "Item updated" : "Item added");
      onSaved(data.item);
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setForm(toFormState(item, defaultCategoryId));
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit item" : "Add menu item"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this dish." : "Add a dish to your menu."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="scrollbar-none flex max-h-[75vh] flex-col gap-4 overflow-y-auto px-1"
        >
          {/* Two columns rather than one long stack: the dish's own fields on
              the left, sizes and add-ons — which can grow arbitrarily long —
              on the right, so a plain item's dialog isn't dominated by empty
              "optional" sections and a loaded one doesn't force page scroll. */}
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
              {form.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => update("imageUrl", "")}
                    className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
                    aria-label="Remove image"
                  >
                    <X className="size-3" />
                  </button>
                </>
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImagePlus className="size-6" />
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <ImagePlus data-icon="inline-start" />
                )}
                {isUploading ? "Uploading…" : form.imageUrl ? "Replace photo" : "Add photo"}
              </Button>
              <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · max 5MB</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Paneer Butter Masala"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-price">Price (₹)</Label>
              <Input
                id="item-price"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => update("categoryId", v ?? form.categoryId)}
                items={categories.map((category) => ({ value: category.id, label: category.name }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-serve-time">Serve time (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="item-serve-time"
                type="number"
                min={0}
                max={240}
                value={form.prepMinutes}
                onChange={(e) => update("prepMinutes", e.target.value)}
                placeholder="20"
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Roughly how long the kitchen takes. Guests see it as &ldquo;~20 min&rdquo;. Leave
              blank to show nothing.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              rows={2}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Cottage cheese in a rich tomato and butter gravy"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
            <Label htmlFor="item-veg" className="cursor-pointer">
              Vegetarian
            </Label>
            <Switch
              id="item-veg"
              checked={form.isVeg}
              onCheckedChange={(checked) => update("isVeg", checked)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
            <div>
              <Label htmlFor="item-available" className="cursor-pointer">
                Available
              </Label>
              <p className="text-xs text-muted-foreground">
                Unavailable items stay on the menu, greyed out.
              </p>
            </div>
            <Switch
              id="item-available"
              checked={form.isAvailable}
              onCheckedChange={(checked) => update("isAvailable", checked)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
            <div>
              <Label htmlFor="item-demote-at-peak" className="cursor-pointer">
                Hide during rush
              </Label>
              <p className="text-xs text-muted-foreground">
                Moves this dish to the last page of your menu during your rush hours, so fewer
                guests order it while the kitchen is busy. It stays fully orderable.
              </p>
            </div>
            <Switch
              id="item-demote-at-peak"
              checked={form.demoteAtPeak}
              onCheckedChange={(checked) => update("demoteAtPeak", checked)}
            />
          </div>
          </div>

          <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sizes (optional)</p>
                <p className="text-xs text-muted-foreground">
                  A guest picks exactly one. Price adjusts the base — negative for smaller.
                </p>
              </div>
              <Button type="button" variant="outline" size="xs" onClick={addVariant}>
                <Plus data-icon="inline-start" /> Add size
              </Button>
            </div>

            {form.variants.map((variant, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDefaultVariant(index)}
                  aria-label={variant.isDefault ? "Default size" : "Make this the default size"}
                  aria-pressed={variant.isDefault}
                  className="shrink-0 p-1 text-muted-foreground data-[active=true]:text-amber-500"
                  data-active={variant.isDefault}
                  title="Default size"
                >
                  <Star className={variant.isDefault ? "size-4 fill-current" : "size-4"} />
                </button>
                <Input
                  value={variant.name}
                  onChange={(e) => updateVariant(index, { name: e.target.value })}
                  placeholder="Half"
                  className="min-w-0 flex-1"
                  required
                />
                <Input
                  type="number"
                  value={variant.priceDelta}
                  onChange={(e) => updateVariant(index, { priceDelta: e.target.value })}
                  placeholder="0"
                  className="w-24 shrink-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${variant.name || "this size"}`}
                  onClick={() => removeVariant(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Add-ons (optional)</p>
                <p className="text-xs text-muted-foreground">A guest may choose any number.</p>
              </div>
              <Button type="button" variant="outline" size="xs" onClick={addAddOn}>
                <Plus data-icon="inline-start" /> Add add-on
              </Button>
            </div>

            {form.addOns.map((addOn, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <Input
                  value={addOn.name}
                  onChange={(e) => updateAddOn(index, { name: e.target.value })}
                  placeholder="Extra cheese"
                  className="min-w-0 flex-1"
                  required
                />
                <Input
                  type="number"
                  min={0}
                  value={addOn.price}
                  onChange={(e) => updateAddOn(index, { price: e.target.value })}
                  placeholder="0"
                  className="w-24 shrink-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${addOn.name || "this add-on"}`}
                  onClick={() => removeAddOn(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          </div>
          </div>

          <Button type="submit" disabled={isSaving || isUploading} className="mt-1">
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Add item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
