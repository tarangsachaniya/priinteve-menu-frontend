"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { uploadDirect } from "@/lib/upload";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
      // Goes straight to S3 — the API only signs it. See lib/upload.ts for why
      // the bytes no longer pass through this app's proxy.
      const data = await uploadDirect(file, "/api/restaurant/menu-items/upload-url");
      setForm((prev) => ({
        ...prev,
        imageUrl: data.imageUrl as string,
        imagePublicId: data.imagePublicId as string,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
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

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="mb-4 flex w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="pricing" className="flex-1">Pricing</TabsTrigger>
              <TabsTrigger value="availability" className="flex-1">Availability</TabsTrigger>
              <TabsTrigger value="variants" className="flex-1">Variants & Add-ons</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex flex-col gap-4">
              <div className="flex gap-4 items-start">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/20 shadow-sm">
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
                <div className="flex flex-col gap-1.5 pt-1">
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
                    className="w-fit"
                  >
                    {isUploading ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <ImagePlus data-icon="inline-start" />
                    )}
                    {isUploading ? "Uploading?" : form.imageUrl ? "Replace photo" : "Add photo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPEG, PNG or WebP ? max 5MB</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-name">Name</Label>
                <Input
                  id="item-name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Paneer Butter Masala"
                  className="bg-background shadow-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => update("categoryId", v ?? form.categoryId)}
                >
                  <SelectTrigger className="bg-background shadow-sm">
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-description">Description</Label>
                <Textarea
                  id="item-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Cottage cheese in a rich tomato and butter gravy"
                  className="bg-background shadow-sm"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 shadow-sm">
                <Label htmlFor="item-veg" className="cursor-pointer font-medium">
                  Vegetarian
                </Label>
                <Switch
                  id="item-veg"
                  checked={form.isVeg}
                  onCheckedChange={(checked) => update("isVeg", checked)}
                />
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-price">Base Price (?)</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                  required
                  className="max-w-[200px] bg-background shadow-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="availability" className="flex flex-col gap-4 mt-2">
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 shadow-sm">
                <div>
                  <Label htmlFor="item-available" className="cursor-pointer font-medium">
                    Available
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unavailable items stay on the menu, greyed out.
                  </p>
                </div>
                <Switch
                  id="item-available"
                  checked={form.isAvailable}
                  onCheckedChange={(checked) => update("isAvailable", checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 shadow-sm">
                <div>
                  <Label htmlFor="item-demote-at-peak" className="cursor-pointer font-medium">
                    Hide during rush
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5 pr-4">
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

              <div className="flex flex-col gap-1.5 pt-2">
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
                    className="w-28 bg-background shadow-sm"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Roughly how long the kitchen takes. Guests see it as &ldquo;~20 min&rdquo;. Leave
                  blank to show nothing.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="variants" className="flex flex-col gap-6 mt-2">
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/10 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Sizes (optional)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      A guest picks exactly one. Price adjusts the base ? negative for smaller.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                    <Plus data-icon="inline-start" className="size-4 mr-1" /> Add size
                  </Button>
                </div>

                {form.variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDefaultVariant(index)}
                      aria-label={variant.isDefault ? "Default size" : "Make this the default size"}
                      aria-pressed={variant.isDefault}
                      className="shrink-0 p-1 text-muted-foreground data-[active=true]:text-amber-500 transition-colors hover:text-amber-500"
                      data-active={variant.isDefault}
                      title="Default size"
                    >
                      <Star className={variant.isDefault ? "size-5 fill-current" : "size-5"} />
                    </button>
                    <Input
                      value={variant.name}
                      onChange={(e) => updateVariant(index, { name: e.target.value })}
                      placeholder="Half"
                      className="min-w-0 flex-1 bg-background"
                      required
                    />
                    <Input
                      type="number"
                      value={variant.priceDelta}
                      onChange={(e) => updateVariant(index, { priceDelta: e.target.value })}
                      placeholder="0"
                      className="w-24 shrink-0 bg-background"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove"
                      onClick={() => removeVariant(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/10 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Add-ons (optional)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">A guest may choose any number.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addAddOn}>
                    <Plus data-icon="inline-start" className="size-4 mr-1" /> Add add-on
                  </Button>
                </div>

                {form.addOns.map((addOn, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={addOn.name}
                      onChange={(e) => updateAddOn(index, { name: e.target.value })}
                      placeholder="Extra cheese"
                      className="min-w-0 flex-1 bg-background"
                      required
                    />
                    <Input
                      type="number"
                      min={0}
                      value={addOn.price}
                      onChange={(e) => updateAddOn(index, { price: e.target.value })}
                      placeholder="0"
                      className="w-24 shrink-0 bg-background"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove"
                      onClick={() => removeAddOn(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

<Button type="submit" disabled={isSaving || isUploading} className="mt-1">
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Add item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
