"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Loader2, ShoppingBag, Store, Wallet, X } from "lucide-react";
import type { RestoOrderType } from "@/lib/api/enums";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { extractNationalDigits, formatMobile } from "@/lib/restaurant/mobile";
import { computeOrderTotals } from "@/lib/restaurant/pricing";
import { ORDER_TYPE_LABEL } from "@/lib/restaurant/order-status";
import { writeResumeOrder } from "@/lib/restaurant/order-recovery";
import { OverlayShell } from "@/components/order/overlay-shell";
import type { CartLine, PublicRestaurant, PublicTable } from "@/components/order/types";

const ORDER_TYPE_ICON: Record<RestoOrderType, typeof Store> = {
  DINE_IN: Store,
  TAKE_AWAY: ShoppingBag,
  DELIVERY: Bike,
};

const PICKUP_OPTIONS = [
  { value: 0, label: "As soon as possible" },
  { value: 15, label: "In 15 minutes" },
  { value: 30, label: "In 30 minutes" },
  { value: 60, label: "In an hour" },
];

/**
 * Placing an order and paying for it are now two separate moments. This sheet
 * only does the first: it collects who the guest is and how they want the food
 * delivered, then hands off to the kitchen. Payment happens on the status page
 * once the restaurant closes the bill — see components/order/payment-panel.tsx.
 */
export function CheckoutSheet({
  restaurant,
  table,
  lines,
  customer,
  onChangeIdentity,
  onClose,
}: {
  restaurant: PublicRestaurant;
  table: PublicTable | null;
  lines: CartLine[];
  /**
   * Required, not optional: the menu asks for a number before it can be
   * browsed, so checkout is only ever reached by an identified guest. That is
   * why this sheet no longer collects a name or a mobile itself.
   */
  customer: { name: string; mobile: string };
  onChangeIdentity: () => void;
  onClose: () => void;
}) {
  const router = useRouter();

  // Dine-in is only offered when the customer actually scanned a table.
  const availableTypes = restaurant.orderTypes.filter(
    (type) => type !== "DINE_IN" || Boolean(table)
  );

  const [orderType, setOrderType] = useState<RestoOrderType>(availableTypes[0]);
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [pickupInMinutes, setPickupInMinutes] = useState(0);
  const [note, setNote] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);

  // The session stores the mobile canonically as +91…; the API wants the bare
  // ten digits.
  const nationalDigits = extractNationalDigits(customer.mobile);

  // unitPrice, not item.price — the line already has variants and add-ons
  // folded in, and using the base price here would quote a total the server
  // will not agree with.
  const totals = computeOrderTotals({
    items: lines.map((line) => ({ unitPrice: line.unitPrice, quantity: line.quantity })),
    rules: { taxPercent: restaurant.taxPercent, deliveryFee: restaurant.deliveryFee },
    orderType,
  });

  const belowMinimum = totals.subtotal < restaurant.minOrderValue;

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();

    if (belowMinimum) {
      toast.error(`Minimum order value is ${formatCurrency(restaurant.minOrderValue)}`);
      return;
    }

    setIsPlacing(true);
    try {
      const res = await fetch("/api/order/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: restaurant.slug,
          tableCode: table?.code,
          customerName: customer.name,
          mobile: nationalDigits,
          type: orderType,
          // Option ids travel with each line; the server re-prices them.
          items: lines.map((line) => ({
            menuItemId: line.item.id,
            quantity: line.quantity,
            variantId: line.variant?.id,
            addOnIds: line.addOns.map((addOn) => addOn.id),
          })),
          note: note.trim() || undefined,
          deliveryAddress: orderType === "DELIVERY" ? address.trim() : undefined,
          deliveryPincode: orderType === "DELIVERY" ? pincode.trim() : undefined,
          deliveryNotes:
            orderType === "DELIVERY" && deliveryNotes.trim() ? deliveryNotes.trim() : undefined,
          pickupInMinutes: orderType === "TAKE_AWAY" ? pickupInMinutes : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not place your order");
        setIsPlacing(false);
        return;
      }

      toast.success(`Order #${data.orderNumber} placed`);
      writeResumeOrder(restaurant.slug, {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        statusUrl: data.statusUrl,
        placedAt: new Date().toISOString(),
      });
      router.push(data.statusUrl);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setIsPlacing(false);
    }
  }

  return (
    <OverlayShell tone="checkout" label="Checkout" onClose={onClose}>
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--resto-border)" }}
        >
          <div>
            <h2 className="resto-display text-xl font-semibold" style={{ color: "var(--resto-text)" }}>
              Checkout
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--resto-text-muted)" }}>
              Review your order and place it in a few taps.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--resto-text-muted)" }}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <form onSubmit={placeOrder} className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
        {/* Shown rather than hidden: someone ordering on a friend's phone has
            to be able to notice the wrong name and fix it. */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Your details</h3>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Ordering as</p>
              <p className="break-words text-sm font-medium">{customer.name}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatMobile(customer.mobile)}
              </p>
            </div>
            <Button type="button" variant="outline" size="xs" onClick={onChangeIdentity}>
              Change
            </Button>
          </div>
        </section>

        {availableTypes.length > 1 && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Order type</h3>
            <div className="grid grid-cols-3 gap-2">
              {availableTypes.map((type) => {
                const Icon = ORDER_TYPE_ICON[type];
                const active = orderType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setOrderType(type)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-colors ${
                      active
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <Icon className="size-4" />
                    {ORDER_TYPE_LABEL[type]}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {orderType === "DINE_IN" && table && (
          <p className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            Serving to <span className="font-medium text-foreground">{table.label}</span>
          </p>
        )}

        {orderType === "DELIVERY" && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Delivery address</h3>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checkout-address">Address</Label>
              <Textarea
                id="checkout-address"
                rows={2}
                placeholder="Flat / house, street, landmark"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checkout-pincode">Pincode</Label>
              <Input
                id="checkout-pincode"
                inputMode="numeric"
                maxLength={6}
                placeholder="400050"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checkout-delivery-notes">Delivery instructions (optional)</Label>
              <Input
                id="checkout-delivery-notes"
                placeholder="Ring the bell twice"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
              />
            </div>
          </section>
        )}

        {orderType === "TAKE_AWAY" && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Pickup time</h3>
            <div className="grid grid-cols-2 gap-2">
              {PICKUP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPickupInMinutes(option.value)}
                  className={`rounded-2xl border px-3 py-2 text-xs font-medium transition-colors ${
                    pickupInMinutes === option.value
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="checkout-note">Note for the kitchen (optional)</Label>
          <Input
            id="checkout-note"
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
              <span className="text-muted-foreground">Tax ({restaurant.taxPercent}%)</span>
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

        {belowMinimum && (
          <p className="text-center text-xs text-destructive">
            Add {formatCurrency(restaurant.minOrderValue - totals.subtotal)} more to reach the{" "}
            {formatCurrency(restaurant.minOrderValue)} minimum.
          </p>
        )}

        {/* Said before the button, not after: a guest who expects to pay now
            and is not asked to will assume the order failed. */}
        <p
          className="flex items-start gap-2 px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--resto-surface-alt)",
            borderRadius: "var(--resto-radius-md)",
            color: "var(--resto-text-muted)",
          }}
        >
          <Wallet className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {orderType === "DINE_IN"
            ? "No payment now. You'll be asked to pay by UPI or cash once the restaurant closes your bill."
            : "You'll pay by UPI or cash right after you place this order."}
        </p>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Back
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isPlacing || belowMinimum}
            className="flex-[2]"
          >
            {isPlacing && <Loader2 data-icon="inline-start" className="animate-spin" />}
            {isPlacing ? "Placing…" : `Place order · ${formatCurrency(totals.total)}`}
          </Button>
        </div>
        </form>
    </OverlayShell>
  );
}
