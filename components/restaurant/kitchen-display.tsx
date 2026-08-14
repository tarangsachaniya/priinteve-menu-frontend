"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, Lock, Maximize, Minimize, MonitorOff, StickyNote, Timer } from "lucide-react";
import { toast } from "sonner";

import type { RestoOrderStatus } from "@/lib/api/enums";
import { Button } from "@/components/ui/button";
import { CancelOrderDialog } from "@/components/restaurant/cancel-order-dialog";
import { elapsedSince, minutesWaiting } from "@/lib/restaurant/elapsed";
import { CONSOLE_ORDERS_PATH, type KitchenOrder } from "@/lib/restaurant/live-order";
import { patchOrderStatus } from "@/lib/restaurant/order-actions";
import { subscribeOrderAck } from "@/lib/restaurant/order-ack";
import { ORDER_TYPE_LABEL, nextStatus } from "@/lib/restaurant/order-status";
import { useWakeLock } from "@/lib/restaurant/wake-lock";
import { cn } from "@/lib/utils";

/**
 * The kitchen display — a full-screen, touch-first board for a wall-mounted
 * tablet in the kitchen itself.
 *
 * It is not a bigger version of /r/orders. The board is built for a manager
 * scanning money and payment state; this is built for a cook who needs to read
 * a ticket from a metre away with their hands full, and who cares about exactly
 * three things: what to make, how long it has been waiting, and one button to
 * push when it's done.
 *
 * SO, DELIBERATELY ABSENT: prices, payment pills, phone numbers, invoices.
 * All of those live on the board, one tap away, and every one of them on this
 * screen would be a line of text competing with the dish names.
 */

const POLL_INTERVAL_MS = 8000;

/** How often the elapsed timers advance. One timer for the screen, not one per ticket. */
const CLOCK_INTERVAL_MS = 1000;

/**
 * Three lanes, not the board's four. A wall screen is horizontally constrained,
 * and to a cook "accepted" and "preparing" are one state — food that has been
 * committed to and is not out yet.
 */
const LANES: { key: string; label: string; statuses: RestoOrderStatus[]; hint: string }[] = [
  { key: "new", label: "New", statuses: ["PLACED"], hint: "Accept to start the clock" },
  { key: "cooking", label: "Cooking", statuses: ["ACCEPTED", "PREPARING"], hint: "On the pass" },
  { key: "ready", label: "Ready", statuses: ["READY"], hint: "Waiting to be collected" },
];

const ADVANCE_LABEL: Partial<Record<RestoOrderStatus, string>> = {
  ACCEPTED: "Accept",
  PREPARING: "Start cooking",
  READY: "Mark ready",
};

/** Minutes waited before a ticket starts shouting. */
const WARN_AFTER_MINUTES = 10;
const LATE_AFTER_MINUTES = 20;

export function KitchenDisplay({
  initialOrders,
  /**
   * Which orders API to work through. Defaults to the console's, which needs a
   * staff session; a mounted screen passes /api/screen/<token>/orders, reached
   * with an unguessable link and the restaurant's PIN instead.
   */
  ordersBasePath = CONSOLE_ORDERS_PATH,
  /** Rendered as a Lock button when present. Only mounted screens can lock. */
  onLock,
  /**
   * Called when the API stops accepting this screen's credentials — the owner
   * rotated the link or changed the PIN. Without it the screen would sit on the
   * last tickets it managed to fetch, looking perfectly healthy, forever.
   */
  onSessionLost,
  /** Shown in the header on a mounted screen, where no sidebar names the place. */
  restaurantName,
}: {
  initialOrders: KitchenOrder[];
  ordersBasePath?: string;
  onLock?: () => void;
  onSessionLost?: () => void;
  restaurantName?: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<KitchenOrder | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const knownIds = useRef(new Set(initialOrders.map((order) => order.id)));
  const wakeLock = useWakeLock();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(ordersBasePath, { cache: "no-store" });
      if (res.status === 401 || res.status === 404) {
        onSessionLost?.();
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { orders: KitchenOrder[] };
      knownIds.current = new Set(data.orders.map((order) => order.id));
      setOrders(data.orders);
    } catch {
      // Transient failure — the next tick retries.
    }
  }, [ordersBasePath, onSessionLost]);

  useEffect(() => {
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // A till commonly runs this screen and the board at once. Without this the
  // kitchen sits on a stale ticket for up to eight seconds after the counter
  // moves the same order.
  useEffect(() => {
    return subscribeOrderAck(({ orderId }) => {
      if (knownIds.current.has(orderId)) void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error("This browser would not go full screen");
    }
  }

  async function advance(order: KitchenOrder) {
    const next = nextStatus(order.status);
    if (!next) return;

    setBusyId(order.id);
    const result = await patchOrderStatus(order.id, next, undefined, ordersBasePath);
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Could not update the order");
      if (result.conflict) void refresh();
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
  }

  async function confirmCancel(reason: string) {
    const order = pendingCancel;
    setPendingCancel(null);
    if (!order) return;

    setBusyId(order.id);
    const result = await patchOrderStatus(order.id, "CANCELLED", reason || undefined, ordersBasePath);
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Could not cancel the order");
      if (result.conflict) void refresh();
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    knownIds.current.delete(order.id);
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
          <ChefHat className="size-6" />
          Kitchen
          {restaurantName && (
            <span className="text-base font-normal text-muted-foreground">· {restaurantName}</span>
          )}
        </h1>

        <div className="flex items-center gap-3">
          {/* A wake lock that failed silently is a screen that dies at midnight
              with nobody knowing why, so it is said out loud rather than logged. */}
          {!wakeLock.active && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MonitorOff className="size-3.5" />
              {wakeLock.unsupported
                ? "This browser can't keep the screen on — set the device's display timeout to Never."
                : "Screen may sleep"}
            </span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? <Minimize data-icon="inline-start" /> : <Maximize data-icon="inline-start" />}
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </Button>
          {onLock && (
            <Button type="button" variant="outline" size="sm" onClick={onLock}>
              <Lock data-icon="inline-start" />
              Lock
            </Button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
        {LANES.map((lane) => {
          const laneOrders = orders
            .filter((order) => lane.statuses.includes(order.status))
            // Oldest first: the ticket that has waited longest is the next job.
            .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

          return (
            <section key={lane.key} className="flex min-w-0 flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
                <h2 className="text-lg font-semibold text-ink">
                  {lane.label}
                  <span className="ml-2 text-base font-normal tabular-nums text-muted-foreground">
                    {laneOrders.length}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">{lane.hint}</p>
              </div>

              <div className="flex flex-col gap-3">
                {laneOrders.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nothing here.
                  </p>
                )}
                {laneOrders.map((order) => (
                  <KitchenTicket
                    key={order.id}
                    order={order}
                    now={now}
                    isBusy={busyId === order.id}
                    onAdvance={advance}
                    onCancel={setPendingCancel}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <CancelOrderDialog
        order={pendingCancel}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null);
        }}
        onConfirm={confirmCancel}
      />
    </main>
  );
}

function KitchenTicket({
  order,
  now,
  isBusy,
  onAdvance,
  onCancel,
}: {
  order: KitchenOrder;
  now: number;
  isBusy: boolean;
  onAdvance: (order: KitchenOrder) => void;
  onCancel: (order: KitchenOrder) => void;
}) {
  const advanceTo = nextStatus(order.status);
  const waited = minutesWaiting(order.placedAt, now);
  const late = waited >= LATE_AFTER_MINUTES;
  const warn = !late && waited >= WARN_AFTER_MINUTES;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 bg-card p-4",
        late ? "border-destructive" : warn ? "border-amber-500" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold tabular-nums leading-none text-ink">#{order.orderNumber}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {order.tableLabel ?? ORDER_TYPE_LABEL[order.type]}
            {order.customerName && <span> · {order.customerName}</span>}
          </p>
        </div>
        <p
          className={cn(
            "flex shrink-0 items-center gap-1 text-xl font-semibold tabular-nums",
            late ? "text-destructive" : warn ? "text-amber-600" : "text-muted-foreground",
          )}
        >
          <Timer className="size-4" />
          {elapsedSince(order.placedAt, now)}
        </p>
      </div>

      <ul className="flex flex-col gap-2 border-t border-border pt-3">
        {order.items.map((item) => {
          const options = [item.variantName, ...item.addOns].filter(Boolean).join(" · ");
          return (
            <li key={item.id} className="flex gap-2 text-lg leading-snug">
              <span className="shrink-0 font-bold tabular-nums text-ink">{item.quantity}×</span>
              <span className="min-w-0">
                {/* Wrapping, not truncating: a dropped add-on is a remade dish,
                    so a taller ticket is the cheaper outcome. */}
                <span className="break-words font-medium text-ink">{item.name}</span>
                {options && (
                  <span className="block break-words text-sm text-muted-foreground">{options}</span>
                )}
                {item.note && (
                  <span className="mt-1 flex gap-1.5 break-words rounded-lg bg-amber-500/10 px-2 py-1 text-sm font-medium text-amber-800">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                    {item.note}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {order.note && (
        <p className="flex gap-1.5 rounded-xl bg-amber-500/10 p-2.5 text-sm font-medium text-amber-800">
          <StickyNote className="mt-0.5 size-4 shrink-0" />
          {order.note}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          className="shrink-0"
          disabled={isBusy}
          onClick={() => onCancel(order)}
        >
          Cancel
        </Button>
        {advanceTo && ADVANCE_LABEL[advanceTo] ? (
          <Button
            type="button"
            size="lg"
            className="h-14 flex-1 text-lg"
            disabled={isBusy}
            onClick={() => onAdvance(order)}
          >
            {ADVANCE_LABEL[advanceTo]}
          </Button>
        ) : (
          /*
            A READY ticket gets no advance button. Completing an order requires
            paymentStatus PAID (the API 409s otherwise), which is a decision made
            at the till, not at the stove. Offering the button here would mean a
            cook tapping it and getting an error about money they can't see.
          */
          <p className="flex-1 rounded-xl bg-muted px-3 py-3 text-center text-sm font-medium text-muted-foreground">
            At the till
          </p>
        )}
      </div>
    </article>
  );
}
