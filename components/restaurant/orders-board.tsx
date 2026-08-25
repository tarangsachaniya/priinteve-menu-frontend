"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bike,
  Clock,
  MapPin,
  Phone,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Store,
  StickyNote,
} from "lucide-react";
import type { RestoOrderStatus, RestoOrderType, RestoUserRole } from "@/lib/api/enums";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyLane, EmptyState } from "@/components/shared/empty-state";
import { CancelOrderDialog } from "@/components/restaurant/cancel-order-dialog";
import { ManualOrderDialog } from "@/components/restaurant/manual-order-dialog";
import { formatCurrency } from "@/lib/format";
import type { LiveOrder } from "@/lib/restaurant/live-order";
import { formatMobile } from "@/lib/restaurant/mobile";
import { patchOrderStatus } from "@/lib/restaurant/order-actions";
import { subscribeOrderAck } from "@/lib/restaurant/order-ack";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  nextStatus,
} from "@/lib/restaurant/order-status";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 8000;

const TYPE_ICON: Record<RestoOrderType, typeof Store> = {
  DINE_IN: Store,
  TAKE_AWAY: ShoppingBag,
  DELIVERY: Bike,
};

const COLUMNS: { status: RestoOrderStatus; hint: string }[] = [
  { status: "PLACED", hint: "Needs confirming" },
  { status: "ACCEPTED", hint: "Queued for the kitchen" },
  { status: "PREPARING", hint: "Being cooked" },
  { status: "READY", hint: "Waiting for pickup" },
  { status: "PICKED_UP", hint: "Awaiting payment close-out" },
];

/** The board's name for the shared live-order DTO. See lib/restaurant/live-order.ts. */
export type BoardOrder = LiveOrder;

function minutesAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** How a settled invoice was settled, for the pill and nothing else. */
const PAID_LABEL: Record<NonNullable<BoardOrder["paymentMode"]>, string> = {
  ONLINE: "Paid · UPI",
  COUNTER: "Paid · cash",
  UPI_QR: "Paid · UPI QR",
};

/**
 * The payment pill.
 *
 * Five states now, not two. The two that matter operationally are the waiting
 * ones — "Cash at counter" and "UPI QR sent". In both the customer has
 * committed to a method and someone still has to confirm the money arrived,
 * which is a different job from an unpaid order nobody has been asked about
 * yet. They are told apart because the staff member checks a different place:
 * the till for one, the bank alert for the other.
 */
function PaymentPill({ order }: { order: BoardOrder }) {
  const { paymentStatus, paymentMode } = order;

  const { label, tone } =
    paymentStatus === "PAID"
      ? {
          label: paymentMode ? PAID_LABEL[paymentMode] : "Paid",
          tone: "bg-emerald-500/10 text-emerald-700",
        }
      : paymentStatus === "FAILED"
        ? { label: "Payment failed", tone: "bg-destructive/10 text-destructive" }
        : paymentStatus === "REFUNDED"
          ? { label: "Refunded", tone: "bg-muted text-muted-foreground" }
          : paymentStatus === "REQUESTED"
            ? paymentMode === "COUNTER"
              ? { label: "Cash at counter", tone: "bg-blue-500/10 text-blue-700" }
              : paymentMode === "UPI_QR"
                ? { label: "UPI QR sent", tone: "bg-blue-500/10 text-blue-700" }
                : { label: "Awaiting payment", tone: "bg-violet-500/10 text-violet-700" }
            : { label: "Invoice open", tone: "bg-amber-500/10 text-amber-700" };

  return <Badge className={cn("border-transparent", tone)}>{label}</Badge>;
}

function OrderCard({
  order,
  onAdvance,
  onCancel,
  onMarkPaid,
  isBusy,
  role,
}: {
  order: BoardOrder;
  onAdvance: (order: BoardOrder) => void;
  onCancel: (order: BoardOrder) => void;
  onMarkPaid: (order: BoardOrder) => void;
  isBusy: boolean;
  role: RestoUserRole;
}) {
  const TypeIcon = TYPE_ICON[order.type];
  const advanceTo = nextStatus(order.status);

  const canMarkPaid = order.paymentStatus === "REQUESTED" || order.paymentStatus === "FAILED";
  // Completing is gated on the money actually having arrived — cash included,
  // via "Mark paid" below — not just on the kitchen being done.
  const blockedByPayment = advanceTo === "COMPLETED" && order.paymentStatus !== "PAID";
  // Marking picked up or completed is owner-only — enforced for real by
  // orders.routes.ts's role check; this just avoids showing STAFF a button
  // that would 403.
  const isOwnerGatedStep = advanceTo === "PICKED_UP" || advanceTo === "COMPLETED";
  // A dine-in order with no table is a data problem the kitchen has to know
  // about — they have no way to deliver it.
  const missingTable = order.type === "DINE_IN" && !order.tableLabel;

  return (
    <Card className="border-border/80">
      <CardContent className="flex flex-col gap-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          {/* Name and number get a line each. Sharing one truncated line meant
              the number — the half staff need to call the guest — was always
              the half that got cut. */}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold">
              #{order.orderNumber}
              {order.source === "STAFF" && (
                <Badge variant="secondary" className="gap-1 bg-violet-500/10 text-violet-700">
                  Manual
                </Badge>
              )}
            </p>
            <p className="break-words text-xs text-muted-foreground">{order.customerName}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatMobile(order.customerMobile)}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {minutesAgo(order.placedAt)}
          </span>
        </div>

        {/* The table is the single most important routing fact on a dine-in
            ticket, so it gets its own line rather than competing with the
            other pills. */}
        {order.tableLabel ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-2.5 py-1.5 text-sm font-semibold text-ink">
            <Store className="size-4 shrink-0" />
            {order.tableLabel}
          </p>
        ) : (
          missingTable && (
            <p className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-2.5 py-1.5 text-sm font-semibold text-destructive">
              <Store className="size-4 shrink-0" />
              No table on a dine-in order
            </p>
          )
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="gap-1">
            <TypeIcon className="size-3" />
            {ORDER_TYPE_LABEL[order.type]}
          </Badge>
          <PaymentPill order={order} />
        </div>

        <ul className="flex flex-col gap-1 rounded-xl bg-muted/60 p-2 text-sm">
          {/* Wrapping, not truncating: a missed "Jain" or a dropped add-on is a
              remade dish, so the card growing taller is the cheaper outcome. */}
          {order.items.map((item) => {
            const options = [item.variantName, ...item.addOns].filter(Boolean).join(" · ");
            return (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="min-w-0">
                  <span className="break-words">
                    <span className="text-muted-foreground tabular-nums">{item.quantity}×</span>{" "}
                    {item.name}
                  </span>
                  {options && (
                    <span className="block break-words text-xs text-muted-foreground">
                      {options}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(item.lineTotal)}
                </span>
              </li>
            );
          })}
        </ul>

        {order.note && (
          <p className="flex gap-1.5 rounded-xl bg-amber-500/10 p-2 text-xs text-amber-800">
            <StickyNote className="size-3.5 shrink-0" />
            {order.note}
          </p>
        )}

        {order.deliveryAddress && (
          <p className="flex gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {order.deliveryAddress}
            {order.deliveryPincode ? `, ${order.deliveryPincode}` : ""}
          </p>
        )}

        {order.pickupInMinutes !== null && (
          <p className="text-xs text-muted-foreground">
            Pickup: {order.pickupInMinutes === 0 ? "ASAP" : `in ${order.pickupInMinutes} min`}
          </p>
        )}

        {canMarkPaid && (
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
            <Button type="button" variant="outline" size="xs" disabled={isBusy} onClick={() => onMarkPaid(order)}>
              {/* Names where to look before tapping. A UPI QR guest has
                  already paid into the bank, not into the till, and a button
                  that says "cash" would have staff checking the wrong one. */}
              {order.paymentMode === "UPI_QR" ? "Mark paid (UPI received)" : "Mark paid (cash)"}
            </Button>
          </div>
        )}

        {blockedByPayment && (
          <p className="rounded-xl bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-800">
            Mark paid to complete
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="font-semibold tabular-nums">{formatCurrency(order.total)}</span>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={isBusy}
              onClick={() => onCancel(order)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              render={<a href={`tel:${order.customerMobile}`} aria-label="Call customer" />}
            >
              <Phone />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              render={
                <a
                  href={`/api/restaurant/orders/${order.id}/invoice`}
                  download
                  aria-label={`Download the invoice for order ${order.orderNumber}`}
                />
              }
            >
              <Receipt />
            </Button>
            {advanceTo &&
              (isOwnerGatedStep && role !== "OWNER" ? (
                <span
                  className="text-xs font-medium text-muted-foreground"
                  title="Only an owner can do this"
                >
                  {advanceTo === "PICKED_UP" ? "Owner marks this picked up" : "Owner completes this order"}
                </span>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  disabled={isBusy || blockedByPayment}
                  title={blockedByPayment ? "Mark this order paid before completing it" : undefined}
                  onClick={() => onAdvance(order)}
                >
                  {advanceTo === "ACCEPTED"
                    ? "Accept"
                    : advanceTo === "PREPARING"
                      ? "Start cooking"
                      : advanceTo === "READY"
                        ? "Mark ready"
                        : advanceTo === "PICKED_UP"
                          ? "Mark picked"
                          : "Complete"}
                </Button>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrdersBoard({
  initialOrders,
  role,
}: {
  initialOrders: BoardOrder[];
  role: RestoUserRole;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [pendingCancel, setPendingCancel] = useState<BoardOrder | null>(null);
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));

  /**
   * Built from the live orders rather than from the table list, so the filter
   * only ever offers tables that currently have something on them. A dropdown
   * of sixty tables, fifty-eight of them empty, is not a filter.
   */
  const tablesInPlay = Array.from(
    new Set(orders.map((order) => order.tableLabel).filter((label): label is string => !!label))
  ).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );

  const visibleOrders =
    tableFilter === "all"
      ? orders
      : orders.filter((order) => order.tableLabel === tableFilter);

  /**
   * Keeps the board's list current. It no longer *announces* anything: telling
   * the kitchen an order arrived belongs to OrderAlertProvider, mounted in the
   * restaurant layout, which does it with the damru and a popup on every
   * console page rather than a silent toast on this one. Two announcers would
   * mean every order reporting itself twice while someone is on this screen.
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/restaurant/orders?scope=live", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const fetched: BoardOrder[] = data.orders;

      knownIds.current = new Set(fetched.map((o) => o.id));
      setOrders(fetched);
    } catch {
      // Transient failures are fine — the next tick retries.
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  /**
   * A till commonly has the board in one tab and the kitchen display in
   * another. Without this the board sits on a stale card for up to eight
   * seconds after the kitchen bumps the same order on the other screen.
   *
   * Only the ack's orderId is trusted — its status is the attempted one, which
   * a 409 makes a guess. So this refetches rather than patching state locally.
   */
  useEffect(() => {
    return subscribeOrderAck((ack) => {
      if (knownIds.current.has(ack.orderId)) void refresh();
    });
  }, [refresh]);

  /**
   * Goes through patchOrderStatus rather than fetching directly so the ack that
   * silences the damru is published as part of the request — see
   * lib/restaurant/order-actions.ts. The optimistic update below still runs, so
   * the drum stops on the same frame the card moves.
   */
  async function updateStatus(order: BoardOrder, status: RestoOrderStatus, cancelReason?: string) {
    setBusyId(order.id);
    try {
      const result = await patchOrderStatus(order.id, status, cancelReason);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update the order");
        // A conflict means someone else already moved this order, so the card
        // on screen is stale. Pull the truth rather than leaving it there.
        if (result.conflict) void refresh();
        return;
      }

      if (status === "COMPLETED" || status === "CANCELLED") {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        knownIds.current.delete(order.id);
      } else {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
      }
    } finally {
      setBusyId(null);
    }
  }

  function advance(order: BoardOrder) {
    const next = nextStatus(order.status);
    if (next) updateStatus(order, next);
  }

  function cancel(order: BoardOrder) {
    setPendingCancel(order);
  }

  function confirmCancel(reason: string) {
    if (!pendingCancel) return;
    updateStatus(pendingCancel, "CANCELLED", reason || undefined);
    setPendingCancel(null);
  }

  /**
   * The invoice closes itself as soon as staff accept an order (see the
   * ACCEPTED transition in restaurant/orders.routes.ts) — this only records
   * that money actually arrived.
   */
  async function markPaid(order: BoardOrder) {
    setBusyId(order.id);
    try {
      const res = await fetch(`/api/restaurant/orders/${order.id}/mark-paid`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not update the payment");
        return;
      }

      toast.success(`#${order.orderNumber} marked paid`);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, paymentStatus: data.order.paymentStatus, paymentMode: data.order.paymentMode }
            : o
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  async function manualRefresh() {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Updating automatically every {POLL_INTERVAL_MS / 1000} seconds.
        </p>
        <div className="flex items-center gap-2">
          <ManualOrderDialog onCreated={() => void refresh()} />
          <Button type="button" variant="outline" size="sm" onClick={manualRefresh} disabled={isRefreshing}>
            <RefreshCw data-icon="inline-start" className={cn(isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {tablesInPlay.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Table</span>
          {["all", ...tablesInPlay].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setTableFilter(label)}
              aria-pressed={tableFilter === label}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                tableFilter === label
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {label === "all" ? "All" : label}
            </button>
          ))}
        </div>
      )}

      {visibleOrders.length === 0 ? (
        <EmptyState
          icon={Store}
          title={tableFilter === "all" ? "No live orders" : `Nothing open on ${tableFilter}`}
          description={
            tableFilter === "all"
              ? "New orders appear here the moment a customer places one."
              : "Switch back to All to see the rest of the board."
          }
        />
      ) : (
        // Three columns, not four: four left each card near 300px on a desktop
        // screen, which is what forced the truncation this layout now avoids.
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {COLUMNS.map((column) => {
            const columnOrders = visibleOrders.filter((order) => order.status === column.status);

            return (
              <section key={column.status} className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-full bg-card px-3 py-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      ORDER_STATUS_BADGE[column.status]
                    )}
                  >
                    {ORDER_STATUS_LABEL[column.status]}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {columnOrders.length}
                  </span>
                </div>

                {columnOrders.length === 0 ? (
                  <EmptyLane>{column.hint}</EmptyLane>
                ) : (
                  columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAdvance={advance}
                      onCancel={cancel}
                      onMarkPaid={markPaid}
                      isBusy={busyId === order.id}
                      role={role}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}

      <CancelOrderDialog
        order={pendingCancel}
        onOpenChange={(open) => !open && setPendingCancel(null)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
