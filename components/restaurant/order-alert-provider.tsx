"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Bike, Check, EyeOff, ShoppingBag, Store, Volume2, X } from "lucide-react";
import { toast } from "sonner";

import type { RestoOrderType } from "@/lib/api/enums";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CancelOrderDialog, type CancellableOrder } from "@/components/restaurant/cancel-order-dialog";
import { formatCurrency } from "@/lib/format";
import { createDamru, type Damru } from "@/lib/restaurant/damru";
import { CONSOLE_ORDERS_PATH } from "@/lib/restaurant/live-order";
import { patchOrderStatus } from "@/lib/restaurant/order-actions";
import { subscribeOrderAck } from "@/lib/restaurant/order-ack";
import { isPushSupported, registerServiceWorker } from "@/lib/restaurant/push-client";
import { ORDER_TYPE_LABEL } from "@/lib/restaurant/order-status";

/**
 * The console-wide new-order alert.
 *
 * Mounted once in app/(restaurant)/layout.tsx and once in app/(kitchen)/layout.tsx,
 * so it is live on every staff page rather than only on the board — "global" in
 * the sense that matters, which is that an owner editing their menu still hears
 * the order come in.
 *
 * ── THE RING ──────────────────────────────────────────────────────────────────
 *
 * The damru repeats until an order is accepted or cancelled. One invariant
 * governs the whole component, and no edit should be able to drift from it:
 *
 *     The drum rings iff `ringing` is non-empty. `ringing` is recomputed from
 *     the server every poll as {orders with status PLACED} minus `acked`.
 *     HIDING THE POPUP DOES NOT TOUCH `ringing`.
 *
 * That last sentence is the feature. A drum that stopped when someone clicked
 * the thing away would be the old fire-once alert wearing a costume.
 *
 * `acked` is the only client-side override, and it exists solely to close the
 * few seconds between a successful PATCH and the poll that confirms it. Ids are
 * pruned from it the moment the server stops reporting them as PLACED — that
 * self-pruning is what stops it becoming a permanent latch, which is precisely
 * the bug the old `announced` set had.
 *
 * ── TWO TRANSPORTS, ONE RING ──────────────────────────────────────────────────
 *
 *   push   fastest way to learn an order ARRIVED. The service worker is woken by
 *          the push service even when this tab is hidden, and postMessages here.
 *   poll   the only way to learn an order LEFT. Push fires on placement and
 *          never on a status change, so a console that trusted push alone would
 *          have no way at all of hearing that a manager accepted on their phone.
 *          This is why the poll no longer stands down while the drum is ringing.
 *
 * Plus order-ack.ts for the same machine, so tapping Accept on this device stops
 * the drum on the same frame instead of at the next poll.
 */

/**
 * Gap between phrases. One damru run is ~0.8s of sound, so this leaves ~3.2s of
 * silence — about fifteen phrases a minute.
 *
 * Tighter than ~3s and the phrases stop reading as separate events; the ear
 * files the result under "background noise" within a minute, which is the exact
 * opposite of what an unignorable alert is for. Looser than ~6s and it reads as
 * a notification rather than an alarm, and a busy kitchen will let it run.
 */
const RING_INTERVAL_MS = 4000;

/**
 * Poll cadence while something is ringing. Fast, because this is the only
 * channel that can hear another device accept, and every second of lag here is
 * a second of drumming at a kitchen that has already dealt with the order.
 */
const RING_POLL_MS = 5000;

/** Poll cadence when nothing is ringing. Unchanged from the fire-once alert. */
const IDLE_POLL_MS = 20_000;

/** Per-device, deliberately: one till may want silence while another does not. */
const SOUND_PREF_KEY = "pv:resto:alert-sound";

type RingOrder = {
  orderId: string;
  orderNumber: number;
  orderType: RestoOrderType;
  tableLabel: string | null;
  total: number;
  itemCount: number;
  customerName: string;
  /** ISO. Only used to put the longest-waiting order at the front of the queue. */
  placedAt: string;
};

type LiveOrderResponse = {
  orders: {
    id: string;
    orderNumber: number;
    status: string;
    type: RestoOrderType;
    tableLabel: string | null;
    total: number;
    customerName: string;
    placedAt: string;
    items: unknown[];
  }[];
};

const TYPE_ICON: Record<RestoOrderType, typeof Store> = {
  DINE_IN: Store,
  TAKE_AWAY: ShoppingBag,
  DELIVERY: Bike,
};

function soundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SOUND_PREF_KEY) !== "off";
}

export function OrderAlertProvider({
  /**
   * The kitchen display sets this false. That screen already renders every
   * PLACED ticket at three times the board's size with an Accept button on it,
   * so a modal would cover the exact thing it is alerting about — on a touch
   * screen, needing a tap with wet hands to clear. The drum, the ringing pill
   * and the sound-unlock affordance all still apply there.
   */
  showDialog = true,
  /**
   * Which orders API to watch. A mounted kitchen screen has no staff session,
   * so it passes its own /api/screen/<token>/orders — the console path would
   * 401 there on every poll and the drum would never ring.
   */
  ordersBasePath = CONSOLE_ORDERS_PATH,
  /**
   * Web Push is a staff-console feature: it needs a person to grant the
   * notification permission and a device registered against their login. A wall
   * screen has neither, so it polls only.
   */
  enablePush = true,
}: {
  showDialog?: boolean;
  ordersBasePath?: string;
  enablePush?: boolean;
} = {}) {
  const router = useRouter();

  const [ringing, setRinging] = useState<RingOrder[]>([]);
  const [hidden, setHidden] = useState(false);
  const [needsSoundUnlock, setNeedsSoundUnlock] = useState(false);
  const [pendingReject, setPendingReject] = useState<CancellableOrder | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Ids this device has successfully acted on, kept only until the server
   * confirms. See the invariant at the top of the file for why this must never
   * become a permanent set.
   */
  const acked = useRef<Set<string>>(new Set());
  /** Mirror of `ringing`'s ids, so effects can diff without depending on state. */
  const ringingIds = useRef<Set<string>>(new Set());
  const damru = useRef<Damru | null>(null);
  const pushActive = useRef(false);
  /** Whether one round trip has completed — gates the push stand-down only. */
  const seeded = useRef(false);
  /** Whatever the title was before an alert prefixed it. */
  const baseTitle = useRef<string>("");

  if (damru.current === null && typeof window !== "undefined") {
    damru.current = createDamru();
  }

  const isRinging = ringing.length > 0;

  /** Removes an order from the ring. The one place the drum is allowed to stop. */
  const clearFromRing = useCallback((orderId: string) => {
    acked.current.add(orderId);
    if (!ringingIds.current.has(orderId)) return;

    const nextIds = new Set(ringingIds.current);
    nextIds.delete(orderId);
    ringingIds.current = nextIds;

    setRinging((prev) => {
      const next = prev.filter((order) => order.orderId !== orderId);
      // Only silence the phrase in flight when nothing is left. With another
      // order still waiting the drum should carry straight on — there is more
      // work, and a gap would read as "handled".
      if (next.length === 0) damru.current?.stopAll();
      return next;
    });
  }, []);

  /** Adds an order to the ring. Used by the push transport only; the poll sets the list wholesale. */
  const announce = useCallback((order: RingOrder) => {
    if (acked.current.has(order.orderId)) return;
    if (ringingIds.current.has(order.orderId)) return;

    const nextIds = new Set(ringingIds.current);
    nextIds.add(order.orderId);
    ringingIds.current = nextIds;

    setRinging((prev) => [...prev, order]);
    setHidden(false);
  }, []);

  // ── the poll ──────────────────────────────────────────────────────────────
  const tick = useCallback(async () => {
    // Push, when working, is both faster and cheaper for *arrivals*. But it
    // cannot report a departure, so this early return is allowed only while
    // nothing is ringing. Removing that condition is how the cross-device stop
    // silently breaks.
    if (seeded.current && pushActive.current && ringingIds.current.size === 0) return;

    try {
      const res = await fetch(ordersBasePath, { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as LiveOrderResponse;

      const placedIds = new Set<string>();
      const placed: RingOrder[] = [];
      for (const order of data.orders) {
        if (order.status !== "PLACED") continue;
        placedIds.add(order.id);
        placed.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderType: order.type,
          tableLabel: order.tableLabel,
          total: order.total,
          itemCount: order.items.length,
          customerName: order.customerName,
          placedAt: order.placedAt,
        });
      }

      // Prune confirmed acks. An id the server no longer calls PLACED has been
      // dealt with for real, so the local override has done its job.
      const prunedAcks = new Set<string>();
      acked.current.forEach((id) => {
        if (placedIds.has(id)) prunedAcks.add(id);
      });
      acked.current = prunedAcks;

      // The API sorts placedAt desc; the ring wants the order that has been
      // waiting longest at the front.
      const next = placed
        .filter((order) => !acked.current.has(order.orderId))
        .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

      const hasNew = next.some((order) => !ringingIds.current.has(order.orderId));
      const droppedToEmpty = next.length === 0 && ringingIds.current.size > 0;

      ringingIds.current = new Set(next.map((order) => order.orderId));
      setRinging(next);
      // An order that arrived while the popup was hidden brings it back. Orders
      // already in the ring do not — hiding has to mean something.
      if (hasNew) setHidden(false);
      // Someone else accepted or cancelled the last one. Cut the phrase short.
      if (droppedToEmpty) damru.current?.stopAll();

      seeded.current = true;
    } catch {
      // Transient failure — the next tick retries. Crucially, this does NOT
      // clear the ring: a console that fell silent because its network hiccuped
      // is a console that loses orders.
    }
  }, [ordersBasePath]);

  /**
   * NOTE ON SEEDING: the old provider recorded every already-open order on its
   * first pass so a reload would not re-announce them. That pass is gone. The
   * `status !== "PLACED"` filter above already covers what it was protecting —
   * an accepted order can no longer enter the ring by any path — and the one
   * case it additionally suppressed, a still-unaccepted order after a reload, is
   * now exactly the case that must ring. The provider lives in a layout, so
   * client-side navigation does not remount it; only a real reload re-seeds, and
   * re-ringing on a real reload is correct.
   */
  useEffect(() => {
    void tick();
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    // Self-rescheduling rather than setInterval: a tab returning from the
    // background must not fire a coalesced burst of catch-up ticks, and the
    // cadence has to be able to change without a request in flight being
    // orphaned.
    const loop = () => {
      timer = window.setTimeout(
        async () => {
          if (cancelled) return;
          await tick();
          if (!cancelled) loop();
        },
        isRinging ? RING_POLL_MS : IDLE_POLL_MS,
      );
    };
    loop();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isRinging, tick]);

  // ── the ring loop ─────────────────────────────────────────────────────────
  // One loop for the whole queue, not one per order, and keyed on "is anything
  // ringing" rather than on the array itself — so a second order joining does
  // not restart the cadence mid-phrase.
  useEffect(() => {
    if (!isRinging) return;

    const fire = () => {
      if (!soundEnabled()) return;

      const drum = damru.current;
      if (drum?.isUnlocked()) {
        drum.play();
        setNeedsSoundUnlock(false);
      } else {
        // Re-asserted on every tick rather than latched once. Silence with no
        // explanation is the worst failure this feature has, and a one-shot
        // flag would let the affordance scroll away and never come back.
        setNeedsSoundUnlock(true);
      }
    };

    fire();
    const timer = window.setInterval(fire, RING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isRinging]);

  // ── sound unlock ──────────────────────────────────────────────────────────
  // An AudioContext can only be resumed inside a user gesture, so the first
  // click or keypress anywhere in the console arms the drum for the session.
  //
  // NOT { once: true }: unlock() can fail — on iOS the context can still be
  // suspended when it returns — and a listener that removed itself on that first
  // failed attempt would leave the console permanently silent. With a drum that
  // now rings until someone acts, that is a support call rather than one missed
  // ping. So these unhook themselves only once the drum is actually armed.
  useEffect(() => {
    const drum = damru.current;
    if (!drum) return;

    const unlock = () => {
      void drum.unlock().then(() => {
        if (!drum.isUnlocked()) return;
        setNeedsSoundUnlock(false);
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      });
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ── same-machine acks ─────────────────────────────────────────────────────
  useEffect(() => subscribeOrderAck(({ orderId }) => clearFromRing(orderId)), [clearFromRing]);

  // ── push transport ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enablePush) return;
    if (!isPushSupported()) return;

    void registerServiceWorker();

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "priinteve-order-alerts") return;

      const payload = data.payload;
      if (!payload || payload.type !== "NEW_ORDER") return;

      // A message proves the worker is delivering, so the idle poll can stand
      // down. It does NOT let the ring poll stand down — see tick().
      pushActive.current = true;

      announce({
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        orderType: payload.orderType,
        tableLabel: payload.tableLabel ?? null,
        total: payload.total,
        itemCount: payload.itemCount,
        customerName: payload.customerName,
        placedAt: payload.placedAt ?? new Date().toISOString(),
      });
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [announce, enablePush]);

  // ── tab title badge ───────────────────────────────────────────────────────
  // The cheapest possible signal for a background tab, and the one a person
  // scanning a row of tabs actually notices.
  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;

    document.title =
      ringing.length === 0
        ? baseTitle.current
        : `(${ringing.length}) New order${ringing.length > 1 ? "s" : ""} · ${baseTitle.current}`;

    return () => {
      document.title = baseTitle.current;
    };
  }, [ringing.length]);

  const current = ringing[0] ?? null;
  const waiting = Math.max(0, ringing.length - 1);

  const dialogOpen = showDialog && !hidden && current !== null && pendingReject === null;
  const pillVisible = isRinging && !dialogOpen && pendingReject === null;

  async function enableSound() {
    const drum = damru.current;
    if (!drum) return;
    await drum.unlock();
    if (drum.isUnlocked()) {
      setNeedsSoundUnlock(false);
      drum.play();
    }
  }

  async function accept(order: RingOrder) {
    setBusy(true);
    const result = await patchOrderStatus(order.orderId, "ACCEPTED", undefined, ordersBasePath);
    setBusy(false);

    if (result.conflict) {
      // The ack already fired inside patchOrderStatus, so the ring has stopped.
      // The person still deserves to know why the order vanished.
      toast.info(result.error ?? "Someone else already took this order");
      return;
    }
    if (!result.ok) {
      // No ack, so the drum keeps going — correct, because nothing changed.
      toast.error(result.error ?? "Could not accept the order");
      return;
    }

    toast.success(`Order #${order.orderNumber} accepted`);
    router.refresh();
  }

  function confirmReject(reason: string) {
    const order = pendingReject;
    setPendingReject(null);
    if (!order) return;

    void (async () => {
      const result = await patchOrderStatus(order.id, "CANCELLED", reason || undefined, ordersBasePath);
      if (result.conflict) {
        toast.info(result.error ?? "Someone else already handled this order");
        return;
      }
      if (!result.ok) {
        toast.error(result.error ?? "Could not cancel the order");
        return;
      }
      toast.success(`Order #${order.orderNumber} cancelled`);
      router.refresh();
    })();
  }

  function viewOrders() {
    // Hides the popup, deliberately without touching the ring. Walking to the
    // board is not the same as dealing with the order.
    setHidden(true);
    router.push("/r/orders");
    router.refresh();
  }

  if (!isRinging && pendingReject === null) return null;

  return (
    <>
      {current && (
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && setHidden(true)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-ink">
                  <Bell className="size-5" />
                </span>
                New order #{current.orderNumber}
              </DialogTitle>
              <DialogDescription>
                {waiting > 0
                  ? `+${waiting} more order${waiting > 1 ? "s" : ""} waiting behind this one.`
                  : "The damru keeps ringing until this is accepted or cancelled."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2.5">
              <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-lg font-semibold text-ink">
                {(() => {
                  const TypeIcon = TYPE_ICON[current.orderType];
                  return <TypeIcon className="size-5 shrink-0" />;
                })()}
                {current.tableLabel ?? ORDER_TYPE_LABEL[current.orderType]}
              </p>

              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {current.itemCount === 1 ? "1 item" : `${current.itemCount} items`}
                  {current.customerName ? ` · ${current.customerName}` : ""}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatCurrency(current.total)}
                </span>
              </div>

              {needsSoundUnlock && <EnableSoundButton onClick={enableSound} />}
            </div>

            <DialogFooter className="sm:justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setPendingReject({
                      id: current.orderId,
                      orderNumber: current.orderNumber,
                      total: current.total,
                    })
                  }
                  disabled={busy}
                >
                  <X data-icon="inline-start" />
                  Reject
                </Button>
                <Button type="button" variant="ghost" onClick={() => setHidden(true)} disabled={busy}>
                  <EyeOff data-icon="inline-start" />
                  Hide
                </Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={viewOrders} disabled={busy}>
                  View orders
                </Button>
                <Button type="button" onClick={() => void accept(current)} disabled={busy}>
                  <Check data-icon="inline-start" />
                  Accept
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/*
        The ringing pill.
        Not decoration: an endless drum with no visible cause is this feature's
        worst failure mode, and on the kitchen display — where the dialog is
        suppressed — this is the only thing on screen that explains the noise.
      */}
      {pillVisible && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-primary/15 text-ink">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {ringing.length === 1
                  ? `New order #${ringing[0].orderNumber}`
                  : `${ringing.length} new orders`}
              </p>
              <p className="text-xs text-muted-foreground">Waiting to be accepted</p>
            </div>
            {showDialog && (
              <Button type="button" size="sm" onClick={() => setHidden(false)}>
                Show
              </Button>
            )}
          </div>
          {needsSoundUnlock && <EnableSoundButton onClick={enableSound} />}
        </div>
      )}

      <CancelOrderDialog
        order={pendingReject}
        onOpenChange={(open) => {
          // Closing without confirming returns to the alert — the order is still
          // unhandled, so it must not slip away behind a dismissed dialog.
          if (!open) setPendingReject(null);
        }}
        onConfirm={confirmReject}
      />
    </>
  );
}

function EnableSoundButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-left text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/20"
    >
      <Volume2 className="size-4 shrink-0" />
      Sound is off until you tap once — tap here to turn the damru on.
    </button>
  );
}
