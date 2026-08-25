"use client";

import { useEffect, useMemo, useState } from "react";
import { CirclePlus, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { RestoOrderType } from "@/lib/api/enums";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { extractNationalDigits, isValidIndianMobile } from "@/lib/restaurant/mobile";
import { computeOrderTotals } from "@/lib/restaurant/pricing";
import { ORDER_TYPE_LABEL } from "@/lib/restaurant/order-status";
import { defaultVariant, isCustomisable, useCart } from "@/components/order/use-cart";
import type { PublicAddOn, PublicMenuCategory, PublicMenuItem, PublicVariant } from "@/components/order/types";

/**
 * "Add order" for the restaurant console — staff entering an order on a
 * guest's behalf (a phone order, a walk-in) instead of the guest placing it
 * themselves. Reuses the same cart logic (`useCart`) and pricing math
 * (`computeOrderTotals`) as the guest checkout, and posts to the console's own
 * POST /api/restaurant/orders — a real RestoOrder, tagged `source: STAFF`,
 * that flows through the exact same status/kitchen/history machinery as any
 * other order. See services/restaurant/order-create.ts on the API side.
 */

type Table = { id: string; label: string; isActive: boolean };

type RestaurantRules = {
  taxPercent: number;
  taxInclusive: boolean;
  deliveryFee: number;
  minOrderValue: number;
  dineInEnabled: boolean;
  takeAwayEnabled: boolean;
  deliveryEnabled: boolean;
};

type RawCategory = { id: string; name: string; description: string | null; isActive: boolean; sortOrder: number };
// The console's own GET /api/restaurant/menu-items includes every variant and
// add-on, available or not — the owner's edit form needs the full set. The
// picker below filters back down to what a guest could actually choose.
type RawMenuItem = Omit<PublicMenuItem, "variants" | "addOns"> & {
  categoryId: string;
  variants: (PublicVariant & { isAvailable: boolean })[];
  addOns: (PublicAddOn & { isAvailable: boolean })[];
};

const ORDER_TYPES: RestoOrderType[] = ["DINE_IN", "TAKE_AWAY", "DELIVERY"];

const PICKUP_OPTIONS = [
  { value: 0, label: "As soon as possible" },
  { value: 15, label: "In 15 minutes" },
  { value: 30, label: "In 30 minutes" },
  { value: 60, label: "In an hour" },
];

function typeEnabled(rules: RestaurantRules | null, type: RestoOrderType): boolean {
  if (!rules) return false;
  if (type === "DINE_IN") return rules.dineInEnabled;
  if (type === "TAKE_AWAY") return rules.takeAwayEnabled;
  return rules.deliveryEnabled;
}

export function ManualOrderDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<PublicMenuCategory[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [rules, setRules] = useState<RestaurantRules | null>(null);

  const [orderType, setOrderType] = useState<RestoOrderType>("DINE_IN");
  const [tableId, setTableId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [note, setNote] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [pickupInMinutes, setPickupInMinutes] = useState(0);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cart = useCart(categories);

  function resetForm() {
    setOrderType("DINE_IN");
    setTableId("");
    setCustomerName("");
    setMobile("");
    setNote("");
    setAddress("");
    setPincode("");
    setDeliveryNotes("");
    setPickupInMinutes(0);
    setSearch("");
    cart.clear();
  }

  useEffect(() => {
    if (!open) return;
    resetForm();
    setIsLoadingData(true);
    setLoadError(null);

    (async () => {
      try {
        const [settingsRes, categoriesRes, itemsRes, tablesRes] = await Promise.all([
          fetch("/api/restaurant/settings"),
          fetch("/api/restaurant/categories"),
          fetch("/api/restaurant/menu-items"),
          fetch("/api/restaurant/tables"),
        ]);
        if (!settingsRes.ok || !categoriesRes.ok || !itemsRes.ok || !tablesRes.ok) {
          throw new Error("load failed");
        }

        const settingsData = await settingsRes.json();
        const categoriesData: { categories: RawCategory[] } = await categoriesRes.json();
        const itemsData: { items: RawMenuItem[] } = await itemsRes.json();
        const tablesData: { tables: Table[] } = await tablesRes.json();

        const r = settingsData.restaurant;
        setRules({
          taxPercent: r.taxPercent,
          taxInclusive: r.taxInclusive,
          deliveryFee: r.deliveryFee,
          minOrderValue: r.minOrderValue,
          dineInEnabled: r.dineInEnabled,
          takeAwayEnabled: r.takeAwayEnabled,
          deliveryEnabled: r.deliveryEnabled,
        });

        // Same rules a guest's menu applies — a sold-out dish, a sold-out
        // option, or a hidden category isn't pickable here either.
        const itemsByCategory = new Map<string, PublicMenuItem[]>();
        for (const item of itemsData.items) {
          if (!item.isAvailable) continue;
          const list = itemsByCategory.get(item.categoryId) ?? [];
          list.push({
            ...item,
            variants: item.variants.filter((v) => v.isAvailable),
            addOns: item.addOns.filter((a) => a.isAvailable),
          });
          itemsByCategory.set(item.categoryId, list);
        }
        const grouped: PublicMenuCategory[] = categoriesData.categories
          .filter((c) => c.isActive)
          .map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            items: itemsByCategory.get(c.id) ?? [],
          }))
          .filter((c) => c.items.length > 0);

        setCategories(grouped);
        setTables(tablesData.tables.filter((t) => t.isActive));

        const firstEnabled = ORDER_TYPES.find((t) =>
          t === "DINE_IN" ? r.dineInEnabled : t === "TAKE_AWAY" ? r.takeAwayEnabled : r.deliveryEnabled
        );
        if (firstEnabled) setOrderType(firstEnabled);
      } catch {
        setLoadError("Could not load the menu. Close and try again.");
      } finally {
        setIsLoadingData(false);
      }
    })();
    // Deliberately just [open] — this fetch is meant to run once per open, not
    // re-run as the form's own state (which it also resets) changes underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totals = useMemo(
    () =>
      computeOrderTotals({
        items: cart.lines.map((line) => ({ unitPrice: line.unitPrice, quantity: line.quantity })),
        rules: rules ?? { taxPercent: 0, taxInclusive: false, deliveryFee: 0 },
        orderType,
      }),
    [cart.lines, rules, orderType]
  );

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories
      .map((c) => ({ ...c, items: c.items.filter((i) => i.name.toLowerCase().includes(term)) }))
      .filter((c) => c.items.length > 0);
  }, [categories, search]);

  const nationalDigits = extractNationalDigits(mobile);
  const mobileValid = isValidIndianMobile(mobile);
  const belowMinimum = rules !== null && totals.subtotal > 0 && totals.subtotal < rules.minOrderValue;

  function validationError(): string | null {
    if (cart.lines.length === 0) return "Add at least one item";
    if (customerName.trim().length < 2) return "Enter the customer's name";
    if (!mobileValid) return "Enter a valid 10-digit mobile number";
    if (orderType === "DINE_IN" && !tableId) return "Pick a table";
    if (orderType === "DELIVERY" && !address.trim()) return "Enter a delivery address";
    if (orderType === "DELIVERY" && !/^\d{6}$/.test(pincode.trim())) return "Enter a valid 6-digit pincode";
    if (belowMinimum && rules) return `Minimum order value is ${formatCurrency(rules.minOrderValue)}`;
    return null;
  }

  async function submit() {
    if (isSubmitting) return; // one request in flight at a time — blocks a double-click from creating two orders
    const error = validationError();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/restaurant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: orderType === "DINE_IN" ? tableId : undefined,
          customerName: customerName.trim(),
          mobile: nationalDigits,
          type: orderType,
          items: cart.lines.map((line) => ({
            menuItemId: line.item.id,
            quantity: line.quantity,
            variantId: line.variant?.id,
            addOnIds: line.addOns.map((a) => a.id),
          })),
          note: note.trim() || undefined,
          deliveryAddress: orderType === "DELIVERY" ? address.trim() : undefined,
          deliveryPincode: orderType === "DELIVERY" ? pincode.trim() : undefined,
          deliveryNotes: orderType === "DELIVERY" && deliveryNotes.trim() ? deliveryNotes.trim() : undefined,
          pickupInMinutes: orderType === "TAKE_AWAY" ? pickupInMinutes : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not create the order");
        return;
      }

      toast.success(`Order #${data.orderNumber} created`);
      setOpen(false);
      onCreated();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm">
            <CirclePlus data-icon="inline-start" />
            Add order
          </Button>
        }
      />
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add order</DialogTitle>
          <DialogDescription>Enter an order for a guest — a phone-in or a walk-in.</DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : loadError ? (
          <p className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{loadError}</p>
        ) : (
          <div className="scrollbar-none grid max-h-[75vh] gap-6 overflow-y-auto px-1 md:grid-cols-2">
            {/* Left: pick items */}
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Search dishes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex flex-col gap-4">
                {filteredCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground">No dishes match.</p>
                )}
                {filteredCategories.map((category) => (
                  <div key={category.id} className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category.name}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {category.items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          quantityInCart={cart.quantityByItem.get(item.id) ?? 0}
                          onAddPlain={() => cart.add({ itemId: item.id, variantId: null, addOnIds: [] })}
                          onIncrement={() => cart.increment(cart.plainLineKey(item))}
                          onDecrement={() => cart.decrement(cart.plainLineKey(item))}
                          onAddCustom={(variantId, addOnIds, quantity) =>
                            cart.add({ itemId: item.id, variantId, addOnIds }, quantity)
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: the order being built */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Order lines</Label>
                {cart.lines.length === 0 ? (
                  <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                    No items yet — add some from the menu on the left.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {cart.lines.map((line) => (
                      <li
                        key={line.key}
                        className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium">{line.item.name}</p>
                          {(line.variant || line.addOns.length > 0) && (
                            <p className="break-words text-xs text-muted-foreground">
                              {[line.variant?.name, ...line.addOns.map((a) => a.name)].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => cart.setQuantity(line.key, line.quantity - 1)}
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <span className="w-5 text-center text-sm tabular-nums">{line.quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => cart.setQuantity(line.key, line.quantity + 1)}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${line.item.name}`}
                            onClick={() => cart.setQuantity(line.key, 0)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        <span className="w-16 shrink-0 text-right text-sm tabular-nums">
                          {formatCurrency(line.unitPrice * line.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Order type</Label>
                  <Select
                    value={orderType}
                    onValueChange={(v) => v && setOrderType(v as RestoOrderType)}
                    items={ORDER_TYPES.filter((t) => typeEnabled(rules, t)).map((t) => ({
                      value: t,
                      label: ORDER_TYPE_LABEL[t],
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_TYPES.filter((t) => typeEnabled(rules, t)).map((t) => (
                        <SelectItem key={t} value={t}>
                          {ORDER_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {orderType === "DINE_IN" && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Table</Label>
                    <Select
                      value={tableId}
                      onValueChange={(v) => setTableId(v ?? "")}
                      items={tables.map((t) => ({ value: t.id, label: t.label }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {orderType === "TAKE_AWAY" && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Pickup time</Label>
                    <Select
                      value={String(pickupInMinutes)}
                      onValueChange={(v) => v && setPickupInMinutes(Number(v))}
                      items={PICKUP_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PICKUP_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {orderType === "DELIVERY" && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="manual-order-address">Delivery address</Label>
                    <Textarea
                      id="manual-order-address"
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="manual-order-pincode">Pincode</Label>
                      <Input
                        id="manual-order-pincode"
                        inputMode="numeric"
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="manual-order-delivery-notes">Delivery instructions</Label>
                      <Input
                        id="manual-order-delivery-notes"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-order-name">Customer name</Label>
                  <Input
                    id="manual-order-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-order-mobile">Mobile</Label>
                  <Input
                    id="manual-order-mobile"
                    inputMode="numeric"
                    placeholder="98765 43210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    aria-invalid={mobile.length > 0 && !mobileValid}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-order-note">Note for the kitchen (optional)</Label>
                <Input
                  id="manual-order-note"
                  placeholder="Less spicy, no onion…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <section className="flex flex-col gap-1 rounded-2xl bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {rules?.taxInclusive ? `Includes GST (${rules.taxPercent}%)` : `Tax (${rules?.taxPercent}%)`}
                    </span>
                    <span className="tabular-nums">{formatCurrency(totals.taxAmount)}</span>
                  </div>
                )}
                {totals.deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="tabular-nums">{formatCurrency(totals.deliveryFee)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(totals.total)}</span>
                </div>
              </section>

              <Button type="button" size="lg" disabled={isSubmitting} onClick={() => void submit()}>
                {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
                {isSubmitting ? "Creating…" : `Create order · ${formatCurrency(totals.total)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** One dish in the picker — a plain +/- stepper, or an inline size/add-on/qty form when it needs one. */
function ItemRow({
  item,
  quantityInCart,
  onAddPlain,
  onIncrement,
  onDecrement,
  onAddCustom,
}: {
  item: PublicMenuItem;
  quantityInCart: number;
  onAddPlain: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onAddCustom: (variantId: string | null, addOnIds: string[], quantity: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const customisable = isCustomisable(item);

  function openCustomize() {
    setVariantId(defaultVariant(item)?.id ?? null);
    setAddOnIds([]);
    setQuantity(1);
    setExpanded(true);
  }

  function confirmCustomize() {
    onAddCustom(variantId, addOnIds, quantity);
    setExpanded(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
        </div>
        {customisable ? (
          <Button type="button" variant="outline" size="xs" onClick={() => (expanded ? setExpanded(false) : openCustomize())}>
            {expanded ? "Cancel" : "Customize"}
          </Button>
        ) : quantityInCart === 0 ? (
          <Button type="button" variant="outline" size="xs" onClick={onAddPlain}>
            Add
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon-sm" onClick={onDecrement}>
              <Minus className="size-3.5" />
            </Button>
            <span className="w-5 text-center text-sm tabular-nums">{quantityInCart}</span>
            <Button type="button" variant="outline" size="icon-sm" onClick={onIncrement}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col gap-2.5 border-t border-border px-3 py-2.5">
          {item.variants.length > 0 && (
            <Select value={variantId ?? undefined} onValueChange={(v) => setVariantId(v ?? null)} items={item.variants.map((v) => ({ value: v.id, label: v.name }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {item.variants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {item.addOns.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {item.addOns.map((addOn) => (
                <label key={addOn.id} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={addOnIds.includes(addOn.id)}
                    onCheckedChange={(checked) =>
                      setAddOnIds((prev) => (checked ? [...prev, addOn.id] : prev.filter((id) => id !== addOn.id)))
                    }
                  />
                  {addOn.name} {addOn.price > 0 && `(+${formatCurrency(addOn.price)})`}
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="size-3.5" />
              </Button>
              <span className="w-5 text-center text-sm tabular-nums">{quantity}</span>
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setQuantity((q) => Math.min(50, q + 1))}>
                <Plus className="size-3.5" />
              </Button>
            </div>
            <Button type="button" size="xs" onClick={confirmCustomize}>
              Add to order
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
