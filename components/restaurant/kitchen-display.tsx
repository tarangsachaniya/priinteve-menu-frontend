"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, Lock, Maximize, Minimize, MonitorOff, StickyNote, Timer } from "lucide-react";
import { toast } from "sonner";

import type { RestoOrderStatus } from "@/lib/api/enums";
import { Button } from "@/components/ui/button";
import { CancelOrderDialog } from "@/components/restaurant/cancel-order-dialog";
import { EmptyLane } from "@/components/shared/empty-state";
import { SoundEnableButton } from "@/components/shared/sound-enable-button";
import { createAlertSound, type AlertSound } from "@/lib/restaurant/alert-sound";
import { createDamru } from "@/lib/restaurant/damru";
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

/**
 * How quickly an accept made anywhere else reaches this screen.
 *
 * Was 8s. This is the ONLY channel that carries a till on one device accepting
 * to a tablet on another — order-ack is same-browser by design, and a mounted
 * KDS holds no staff session so Web Push cannot reach it either. Eight seconds
 * of a cook staring at a ticket the counter approved is the whole of "the
 * kitchen doesn't get the order". The payload is a handful of live tickets, so
 * three seconds costs very little and is the difference between "immediate" and
 * "eventually".
 */
const POLL_INTERVAL_MS = 3000;

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

/**
 * The statuses that mean "this is the kitchen's problem now". Entering this set
 * is what rings the pass — see the sound effect below.
 */
const KITCHEN_STATUSES: readonly RestoOrderStatus[] = ["ACCEPTED", "PREPARING"];

/**
 * How long the arrival sound rings before the API has said otherwise.
 *
 * Only ever used for the handful of seconds between this screen mounting and
 * its first poll landing — every response carries the restaurant's real
 * setting, already resolved server-side. Matches DEFAULT_KITCHEN_RING_SECONDS
 * in the API's audio-settings.ts; if they ever disagree the server wins, which
 * is why this is a fallback rather than a source of truth.
 */
const DEFAULT_RING_SECONDS = 30;

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
  /** Starts false so the prompt shows until the browser has actually said yes. */
  const [soundArmed, setSoundArmed] = useState(false);

  const knownIds = useRef(new Set(initialOrders.map((order) => order.id)));
  const wakeLock = useWakeLock();

  /**
   * Rings when an order lands in the kitchen's queue — the moment the counter
   * approves it, not the moment the guest sends it.
   *
   * A cook is across the room with their hands full and never sees the tablet
   * change. OrderAlertProvider rings for PLACED, which is the till's cue to
   * approve; by the time it stops, the kitchen has heard nothing about the food
   * it now has to cook. This is that missing cue.
   *
   * Seeded from the orders already on screen, so mounting the board — or a
   * reconnect that re-lists a full pass — is silent. Only a genuine arrival
   * makes noise.
   */
  const arrivalSound = useRef<AlertSound | null>(null);
  if (arrivalSound.current === null && typeof window !== "undefined") {
    arrivalSound.current = createAlertSound(createDamru());
  }
  const inKitchen = useRef(
    new Set(initialOrders.filter((o) => KITCHEN_STATUSES.includes(o.status)).map((o) => o.id)),
  );

  /**
   * How long to ring, refreshed on every poll.
   *
   * A ref rather than state on purpose: nothing on screen depends on it, and
   * making it state would re-render every ticket on the board each time a poll
   * confirmed the same number.
   */
  const ringSeconds = useRef(DEFAULT_RING_SECONDS);

  /**
   * Orders THIS screen advanced onto the pass itself, held until the server
   * confirms them.
   *
   * `inKitchen` alone cannot carry that. It is reassigned wholesale from every
   * response — which is right, or it would grow all shift — and that wipes the
   * claim advance() writes. A poll already in flight when a cook taps Accept
   * answers with the order still PLACED, erases the claim, and the NEXT poll
   * then sees the order arrive on the pass and rings at the cook who accepted
   * it thirty seconds ago. Ringing at someone for their own action is precisely
   * how a room learns to ignore the sound that matters.
   *
   * Self-pruning, so it can never become a permanent latch: a claim is dropped
   * the moment the server agrees the order is cooking, or the moment the order
   * stops being listed at all.
   */
  const claimed = useRef<Set<string>>(new Set());

  /**
   * The refetch currently in flight, if any. See `refresh` below.
   */
  const inFlight = useRef<Promise<void> | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(ordersBasePath, { cache: "no-store" });
      if (res.status === 401 || res.status === 404) {
        onSessionLost?.();
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as {
        orders: KitchenOrder[];
        kitchenOrderAudioUrl?: string | null;
        kitchenOrderRingSeconds?: number | null;
      };

      /**
       * Only this surface's key, never the till's. Keeping the pass and the
       * counter on separate sounds is deliberate — see OrderAlertProvider. A
       * console session is not served one at all, and null here simply means
       * the built-in drum rings instead of an uploaded file.
       */
      arrivalSound.current?.setSource(data.kitchenOrderAudioUrl ?? null);

      // ?? not ||: zero is the restaurant choosing "ring once" and must not be
      // read as a missing field and replaced with thirty seconds.
      ringSeconds.current = data.kitchenOrderRingSeconds ?? DEFAULT_RING_SECONDS;

      const cooking = data.orders.filter((o) => KITCHEN_STATUSES.includes(o.status));
      const arrived = cooking.some(
        (o) => !inKitchen.current.has(o.id) && !claimed.current.has(o.id),
      );
      // Reassigned wholesale rather than merged: an id the response no longer
      // carries has left the pass for good, and keeping it would grow this set
      // for the whole of a shift on a screen that never reloads.
      inKitchen.current = new Set(cooking.map((o) => o.id));

      // A claim is spent once the server confirms the order is on the pass —
      // inKitchen carries it from here — or once the order drops off the list
      // entirely. Keeping only the still-unconfirmed ones is what stops this
      // becoming a set that silences a genuine future arrival.
      const listedIds = new Set(data.orders.map((o) => o.id));
      const stillClaimed = new Set<string>();
      claimed.current.forEach((id) => {
        if (listedIds.has(id) && !inKitchen.current.has(id)) stillClaimed.add(id);
      });
      claimed.current = stillClaimed;

      // Rings for a window rather than once. A single damru phrase is under a
      // second, which a cook facing a stove with their hands full simply does
      // not hear — and unlike the till, nothing else on this screen will tell
      // them again. Ends early the moment anyone touches a ticket; see advance().
      if (arrived) arrivalSound.current?.playFor(ringSeconds.current * 1000);

      knownIds.current = new Set(data.orders.map((order) => order.id));
      setOrders(data.orders);
    } catch {
      // Transient failure — the next tick retries.
    }
  }, [ordersBasePath, onSessionLost]);

  /**
   * Every refetch goes through here, and overlapping callers share one request.
   *
   * Four things now ask this board to refresh — the interval, the mount, a
   * focus/visibility return, and an ack from the same browser — and switching
   * back to the tab fires two of them in the same instant. Two overlapping
   * fetches would each compare their response against an `inKitchen` set that
   * neither had updated yet, so both would count the same order as newly
   * arrived and the pass would hear one ticket announced twice. Handing the
   * later caller the promise already running is what makes a single order
   * transition produce a single sound, no matter how many things noticed it.
   */
  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;

    const run = fetchOrders().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = run;
    return run;
  }, [fetchOrders]);

  /**
   * Arms the audio ahead of the first order, silently — same approach as the
   * console's alert provider. A wall tablet is usually a device that has played
   * sound before, so this simply succeeds; where the browser refuses, the first
   * touch anyone makes for any other reason arms it instead.
   *
   * The result is reflected on screen rather than left implicit. The alert
   * provider only renders its enable-sound button while an order is ringing, so
   * on this board the affordance would have appeared strictly AFTER a sound had
   * already been missed — no use to a kitchen that needs the first one.
   */
  useEffect(() => {
    const sound = arrivalSound.current;
    if (!sound) return;

    // isUnlocked() alone is satisfied by the AudioContext, so a restaurant
    // whose uploaded track is being refused would see the prompt disappear
    // while only the drum ever rang. Substitution keeps the prompt up.
    const sync = () =>
      setSoundArmed(sound.isUnlocked() && !sound.needsReArm() && !sound.isSubstituting());

    void sound.unlock().then(sync);
    sync();

    // Not `once` — an early tap can land before a source exists, and the
    // element only becomes armed when one arrives, so keep re-checking.
    const arm = () => void sound.unlock().then(sync);
    window.addEventListener("pointerdown", arm);
    return () => window.removeEventListener("pointerdown", arm);
  }, []);

  async function enableSound() {
    const sound = arrivalSound.current;
    if (!sound) return;
    await sound.unlock();
    setSoundArmed(sound.isUnlocked() && !sound.needsReArm() && !sound.isSubstituting());
  }

  useEffect(() => {
    /**
     * Immediately, not in POLL_INTERVAL_MS.
     *
     * The tickets are already on screen from the server render, so this looks
     * redundant — it is not. kitchenOrderAudioUrl rides on this response and on
     * nothing else, so until the first poll lands `source` is null and any
     * arrival rings the synthesized drum instead of the restaurant's own track.
     * That window used to be eight seconds wide and covered exactly the first
     * order after anyone opened the screen.
     */
    void refresh();

    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  /**
   * A backgrounded tab's timers are throttled to roughly once a minute, and a
   * tablet that has been asleep comes back to a board that may be minutes
   * stale. Catching up on the way in costs one request and is the difference
   * between a cook trusting this screen and reaching for the refresh button.
   */
  useEffect(() => {
    const catchUp = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("focus", catchUp);
    return () => {
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("focus", catchUp);
    };
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

    /**
     * Someone is at the board with a finger on a ticket, so the alert has done
     * its whole job and any further ringing is just noise at a room that has
     * already responded.
     *
     * Any ticket, not only the one that rang: the sound says "there is new work
     * on the pass", and a cook touching the screen at all has seen the pass.
     * Deliberately not wired to subscribeOrderAck — that fires for another tab
     * in the same browser, which is no evidence anyone in the kitchen looked up.
     */
    arrivalSound.current?.stopAll();

    setBusyId(order.id);
    const result = await patchOrderStatus(order.id, next, undefined, ordersBasePath);
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Could not update the order");
      if (result.conflict) void refresh();
      return;
    }
    // Claim it before the next poll sees it. A cook who accepted the ticket
    // themselves is already looking at the screen, and ringing at them would
    // teach the room to ignore the sound that matters. Both sets: `inKitchen`
    // covers the common case, `claimed` survives the wholesale reassign that a
    // poll already in flight is about to perform. See `claimed`'s declaration.
    if (KITCHEN_STATUSES.includes(next)) {
      inKitchen.current.add(order.id);
      claimed.current.add(order.id);
    }

    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
  }

  async function confirmCancel(reason: string) {
    const order = pendingCancel;
    setPendingCancel(null);
    if (!order) return;

    // Same rule as advance(): a cook who has opened a dialog and confirmed a
    // cancellation is unambiguously at the board.
    arrivalSound.current?.stopAll();

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
          {/* Sized to be read and hit from across the kitchen, and shown BEFORE
              the first order rather than after one has been missed. Browsers
              refuse unprompted audio until the page has been touched once; this
              is that one touch, made obvious instead of left to be discovered. */}
          {!soundArmed && <SoundEnableButton label="Tap to enable sound" onClick={() => void enableSound()} />}
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

      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-1">
        {LANES.map((lane) => {
          const laneOrders = orders
            .filter((order) => lane.statuses.includes(order.status))
            // Oldest first: the ticket that has waited longest is the next job.
            .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

          return (
            <section key={lane.key} className="flex min-w-[300px] flex-1 basis-0 flex-col gap-3">
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
                {laneOrders.length === 0 && <EmptyLane>Nothing here.</EmptyLane>}
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
        {/* h-14 to match the advance button beside it: a cook working with wet
            or gloved hands is exactly who this screen is built for, and a 36px
            default-size button next to a 56px one is a touch target that's easy
            to miss under a screen's worth of adrenaline. */}
        <Button
          type="button"
          variant="ghost"
          className="h-14 shrink-0 px-5 text-base"
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
