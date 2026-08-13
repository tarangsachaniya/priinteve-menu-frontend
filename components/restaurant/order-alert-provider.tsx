"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Bike, ShoppingBag, Store, Volume2 } from "lucide-react";

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
import { formatCurrency } from "@/lib/format";
import { createDamru, type Damru } from "@/lib/restaurant/damru";
import { isPushSupported, registerServiceWorker } from "@/lib/restaurant/push-client";
import { ORDER_TYPE_LABEL } from "@/lib/restaurant/order-status";

/**
 * The console-wide new-order alert.
 *
 * Mounted once in app/(restaurant)/layout.tsx, so it is live on every /r/* page
 * rather than only on the board — "global" in the sense that matters, which is
 * that an owner editing their menu still hears the order come in.
 *
 * TWO TRANSPORTS, ONE ALERT:
 *
 *   push   primary. The service worker is woken by the push service even when
 *          this tab is hidden or the browser is closed, and it postMessages
 *          here so the damru plays without waiting for a throttled timer.
 *   poll   fallback. For a browser with no push support, or a user who declined
 *          the permission. Runs ONLY when push is not active, so a properly
 *          set-up console makes no extra requests.
 *
 * Both can legitimately deliver the same order, so everything is deduped on
 * orderId — see `announced`.
 */

const POLL_INTERVAL_MS = 20_000;

/** Per-device, deliberately: one till may want silence while another does not. */
const SOUND_PREF_KEY = "pv:resto:alert-sound";

type AlertOrder = {
  orderId: string;
  orderNumber: number;
  orderType: RestoOrderType;
  tableLabel: string | null;
  total: number;
  itemCount: number;
  customerName: string;
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

export function OrderAlertProvider() {
  const router = useRouter();

  const [queue, setQueue] = useState<AlertOrder[]>([]);
  const [needsSoundUnlock, setNeedsSoundUnlock] = useState(false);

  /**
   * Every order id this page has already alerted on. The dedupe point for both
   * transports, and the reason a reload does not re-announce a board full of
   * orders that were placed an hour ago — see the seeding pass below.
   */
  const announced = useRef<Set<string>>(new Set());
  const damru = useRef<Damru | null>(null);
  const pushActive = useRef(false);
  /** Whatever the title was before an alert prefixed it. */
  const baseTitle = useRef<string>("");

  if (damru.current === null && typeof window !== "undefined") {
    damru.current = createDamru();
  }

  /**
   * Announcing is one place, not two, so push and poll cannot drift into
   * alerting differently.
   */
  const announce = useCallback((order: AlertOrder) => {
    if (announced.current.has(order.orderId)) return;
    announced.current.add(order.orderId);

    if (soundEnabled()) {
      const drum = damru.current;
      if (drum?.isUnlocked()) {
        drum.play();
      } else {
        // Silence with no explanation is the failure worth spending UI on: the
        // popup grows an "Enable sound" button rather than the kitchen quietly
        // wondering why the till stopped drumming.
        setNeedsSoundUnlock(true);
      }
    }

    setQueue((prev) => [...prev, order]);
  }, []);

  // ── sound unlock ──────────────────────────────────────────────────────────
  // An AudioContext can only be resumed inside a user gesture, so the first
  // click or keypress anywhere in the console arms the drum for the session.
  // Passive and once, so it costs nothing after it has fired.
  useEffect(() => {
    const drum = damru.current;
    if (!drum) return;

    const unlock = () => {
      void drum.unlock().then(() => {
        if (drum.isUnlocked()) setNeedsSoundUnlock(false);
      });
    };

    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ── push transport ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPushSupported()) return;

    void registerServiceWorker();

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "priinteve-order-alerts") return;

      const payload = data.payload;
      if (!payload || payload.type !== "NEW_ORDER") return;

      // A message proves the worker is delivering, so the poll can stand down.
      pushActive.current = true;

      announce({
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        orderType: payload.orderType,
        tableLabel: payload.tableLabel ?? null,
        total: payload.total,
        itemCount: payload.itemCount,
        customerName: payload.customerName,
      });
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [announce]);

  // ── poll fallback ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    /**
     * The first pass records what is already open WITHOUT alerting. Skipping
     * this would make every page navigation and every reload re-announce the
     * entire board, which is worse than no alert at all.
     */
    let seeded = false;

    async function tick() {
      // Push, when it is working, is both faster and cheaper. This poll exists
      // for the console that has no push — not as a belt-and-braces second
      // request on every till.
      if (seeded && pushActive.current) return;

      try {
        const res = await fetch("/api/restaurant/orders", { cache: "no-store" });
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as {
          orders: {
            id: string;
            orderNumber: number;
            status: string;
            type: RestoOrderType;
            tableLabel: string | null;
            total: number;
            customerName: string;
            items: unknown[];
          }[];
        };

        for (const order of data.orders) {
          if (!seeded) {
            announced.current.add(order.id);
            continue;
          }
          // Only a brand-new ticket is an alert. An order the kitchen has
          // already accepted is one they have plainly seen.
          if (order.status !== "PLACED") {
            announced.current.add(order.id);
            continue;
          }
          announce({
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderType: order.type,
            tableLabel: order.tableLabel,
            total: order.total,
            itemCount: order.items.length,
            customerName: order.customerName,
          });
        }

        seeded = true;
      } catch {
        // Transient failure — the next tick retries. Nothing to tell anyone.
      }
    }

    void tick();
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [announce]);

  // ── tab title badge ───────────────────────────────────────────────────────
  // The cheapest possible signal for a background tab, and the one a person
  // scanning a row of tabs actually notices.
  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;

    document.title =
      queue.length === 0
        ? baseTitle.current
        : `(${queue.length}) New order${queue.length > 1 ? "s" : ""} · ${baseTitle.current}`;

    return () => {
      document.title = baseTitle.current;
    };
  }, [queue.length]);

  const current = queue[0] ?? null;
  const waiting = Math.max(0, queue.length - 1);

  function dismiss() {
    setQueue((prev) => prev.slice(1));
  }

  function viewOrders() {
    setQueue([]);
    router.push("/r/orders");
    router.refresh();
  }

  async function enableSound() {
    await damru.current?.unlock();
    if (damru.current?.isUnlocked()) {
      setNeedsSoundUnlock(false);
      damru.current.play();
    }
  }

  if (!current) return null;

  const TypeIcon = TYPE_ICON[current.orderType];
  const where = current.tableLabel ?? ORDER_TYPE_LABEL[current.orderType];

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
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
              : "Just came in from a guest."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5">
          <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-lg font-semibold text-ink">
            <TypeIcon className="size-5 shrink-0" />
            {where}
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

          {needsSoundUnlock && (
            <button
              type="button"
              onClick={enableSound}
              className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-left text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/20"
            >
              <Volume2 className="size-4 shrink-0" />
              Sound is off until you tap once — tap here to turn the damru on.
            </button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={dismiss}>
            <BellOff data-icon="inline-start" />
            Dismiss
          </Button>
          <Button type="button" onClick={viewOrders}>
            View orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
