"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  CircleX,
  Clock,
  Download,
  Loader2,
  PartyPopper,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { RestoOrderStatus, RestoPaymentStatus } from "@/lib/api/enums";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { estimateOrderMinutes } from "@/lib/restaurant/menu-display";
import type { AnnounceLanguage } from "@/lib/restaurant/announce";
import { createChime, type Chime } from "@/lib/restaurant/chime";
import { enableOrderReadyPush } from "@/lib/order-push-client";
import {
  ORDER_STATUS_CUSTOMER_LABEL,
  ORDER_STATUS_FLOW,
  ORDER_TYPE_LABEL,
} from "@/lib/restaurant/order-status";
import { PaidReceipt, PaymentPanel } from "@/components/order/payment-panel";
import { PlatformCredit } from "@/components/order/platform-credit";
import { ReviewPrompt } from "@/components/order/review-prompt";

const POLL_INTERVAL_MS = 8000;

/**
 * Own key, deliberately — not shared with the pickup board's pv:display:chime.
 * Muting this device's own order-ready alert has nothing to do with the
 * lobby board, and the two must never read each other's preference.
 */
const SOUND_KEY = "pv:order:sound";

const STATUS_HINT: Record<RestoOrderStatus, string> = {
  PLACED: "Waiting for the restaurant to confirm.",
  ACCEPTED: "The restaurant has your order.",
  PREPARING: "Your food is being cooked.",
  READY: "Ready — collect it or wait to be served.",
  COMPLETED: "Enjoy your meal.",
  CANCELLED: "This order was cancelled.",
};

export type StatusOrder = {
  id: string;
  orderNumber: number;
  status: RestoOrderStatus;
  paymentStatus: RestoPaymentStatus;
  paymentMode: "ONLINE" | "COUNTER" | "UPI_QR" | null;
  type: "DINE_IN" | "TAKE_AWAY" | "DELIVERY";
  tableLabel: string | null;
  customerName: string;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
  cancelReason: string | null;
  /** ISO instant the order was placed; the estimate below counts from it. */
  placedAt: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    lineTotal: number;
    variantName: string | null;
    /** Snapshotted at order time — see RestoOrderItem.prepMinutes. */
    prepMinutes: number | null;
    addOns: string[];
  }[];
  restaurantName: string;
  restaurantSlug: string;
  brandColor: string;
  /** Which languages to speak "your order is ready" in — same set and order the pickup board uses. */
  announceLanguages: AnnounceLanguage[];
  canPayOnline: boolean;
  canPayCash: boolean;
  canPayUpiQr: boolean;
  hasReview: boolean;
};

export function OrderStatusTracker({ order: initialOrder }: { order: StatusOrder }) {
  const [status, setStatus] = useState(initialOrder.status);
  const [paymentStatus, setPaymentStatus] = useState(initialOrder.paymentStatus);
  const [paymentMode, setPaymentMode] = useState(initialOrder.paymentMode);
  const [cancelReason, setCancelReason] = useState(initialOrder.cancelReason);
  const [hasReview, setHasReview] = useState(initialOrder.hasReview);

  const isPaid = paymentStatus === "PAID";
  const isCancelled = status === "CANCELLED";
  const isCompleted = status === "COMPLETED";

  /**
   * Read fresh out of every poll response, same reason the pickup board does
   * this — an owner flipping a language on in Settings should take effect on
   * the next tick, not need this page reloaded.
   */
  const announceLanguages = useRef(initialOrder.announceLanguages);
  const chime = useRef<Chime | null>(null);
  const [needsSoundUnlock, setNeedsSoundUnlock] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  /**
   * Seeded true when the order is already at or past READY on first load, so
   * reopening a link to an order that has been sitting ready for an hour does
   * not chime and speak the moment the page mounts — only the actual
   * PLACED/ACCEPTED/PREPARING → READY transition, once, should ever fire it.
   */
  const hasAnnouncedReady = useRef(
    initialOrder.status !== "PLACED" &&
      initialOrder.status !== "ACCEPTED" &&
      initialOrder.status !== "PREPARING",
  );

  if (chime.current === null && typeof window !== "undefined") {
    chime.current = createChime();
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SOUND_KEY) === "off") {
      setSoundMuted(true);
    } else {
      setNeedsSoundUnlock(true);
    }
  }, []);

  // Same tap-anywhere unlock as the pickup board (see chime.ts) — a guest who
  // just tapped through checkout has usually already satisfied this, but a
  // cold reload of a saved link has not.
  //
  // The same gesture also asks for notification permission, once. Both are
  // "let me tell you when your order is ready" and both need a real user
  // gesture to work at all — Notification.requestPermission() is ignored
  // outside one — so there is no reason to make the guest tap twice for two
  // halves of one request. Guarded by a ref, not state: unlike the chime,
  // which only stops listening once it actually succeeds, this must fire
  // exactly once regardless of outcome, or a chime that keeps failing to
  // unlock would keep reopening the browser's permission prompt on every tap.
  useEffect(() => {
    const sound = chime.current;
    if (!sound) return;
    let pushRequested = false;

    const unlock = () => {
      void sound.unlock().then(() => {
        if (!sound.isUnlocked()) return;
        setNeedsSoundUnlock(false);
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      });

      // Skip once the order has already reached READY — see the seeding
      // comment on hasAnnouncedReady above. There is nothing left to notify
      // about, so there is no reason to ask for the permission at all.
      if (!pushRequested && !hasAnnouncedReady.current) {
        pushRequested = true;
        void enableOrderReadyPush(initialOrder.id);
      }
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [initialOrder.id]);

  /**
   * Polling continues after the kitchen is done, which it did not used to.
   * The interesting events now happen *after* COMPLETED — the restaurant
   * closing the invoice, and the counter confirming cash — so stopping at a
   * terminal kitchen status would leave the guest staring at a screen that
   * never opens its payment panel.
   */
  const settled = isCancelled || (isCompleted && hasReview);

  useEffect(() => {
    if (settled) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/order/${initialOrder.id}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const nextStatus: RestoOrderStatus = data.order.status;
        setStatus(nextStatus);
        setPaymentStatus(data.order.paymentStatus);
        setPaymentMode(data.order.paymentMode);
        setCancelReason(data.order.cancelReason);
        setHasReview(data.order.hasReview);
        announceLanguages.current = data.order.announceLanguages;

        // Chime only, deliberately — the spoken announcement is a pickup-board
        // feature (a room of strangers who need their number called out), not
        // this device's own. The guest is already looking at their own screen.
        if (nextStatus === "READY" && !hasAnnouncedReady.current) {
          hasAnnouncedReady.current = true;
          if (window.localStorage.getItem(SOUND_KEY) !== "off") {
            chime.current?.play();
          }
        }
      } catch {
        // A dropped poll is harmless — the next tick will catch up.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [initialOrder.id, initialOrder.orderNumber, settled]);

  function toggleSound() {
    setSoundMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem(SOUND_KEY, next ? "off" : "on");
      if (next) setNeedsSoundUnlock(false);
      return next;
    });
  }

  function dismissSoundBar() {
    window.localStorage.setItem(SOUND_KEY, "off");
    setSoundMuted(true);
    setNeedsSoundUnlock(false);
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);
  const awaitingPayment = paymentStatus === "REQUESTED" || paymentStatus === "FAILED";

  // Nothing left for the sound to announce once the order is done — there is
  // no reason to offer a mute for a chime that will never play again.
  const soundStillMatters = !isCancelled && !isCompleted;

  return (
    <main
      className="relative mx-auto flex min-h-screen max-w-lg flex-col gap-5 px-4 py-8"
      style={{ backgroundColor: "var(--resto-bg)" }}
    >
      {soundStillMatters && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundMuted ? "Turn on order-ready sound" : "Turn off order-ready sound"}
          className="absolute right-4 top-4 flex size-8 items-center justify-center transition-colors"
          style={{
            color: "var(--resto-text-muted)",
            borderRadius: "var(--resto-radius-full)",
          }}
        >
          {soundMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      )}

      <header className="text-center">
        <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
          {initialOrder.restaurantName}
        </p>
        <h1 className="resto-display text-2xl font-bold" style={{ color: "var(--resto-text)" }}>
          Order #{initialOrder.orderNumber}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--resto-text-muted)" }}>
          {ORDER_TYPE_LABEL[initialOrder.type]}
          {initialOrder.tableLabel ? ` · ${initialOrder.tableLabel}` : ""}
        </p>
      </header>

      {soundStillMatters && needsSoundUnlock && !soundMuted && (
        <div
          className="flex items-center justify-between gap-3 border px-4 py-3 text-sm"
          style={{
            backgroundColor: "var(--resto-surface)",
            borderColor: "var(--resto-border)",
            borderRadius: "var(--resto-radius-lg)",
            color: "var(--resto-text-muted)",
          }}
        >
          <span className="flex items-center gap-2">
            <Volume2 className="size-4 shrink-0" aria-hidden />
            Tap anywhere to hear when your order is ready.
          </span>
          <button
            type="button"
            onClick={dismissSoundBar}
            aria-label="Keep this quiet"
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[var(--resto-surface-alt)]"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Payment first once it is due: it is the only thing on this page the
          guest still has to act on. */}
      {!isCancelled && awaitingPayment && (
        <PaymentPanel
          orderId={initialOrder.id}
          total={initialOrder.total}
          brandColor={initialOrder.brandColor}
          restaurantName={initialOrder.restaurantName}
          canPayOnline={initialOrder.canPayOnline}
          canPayCash={initialOrder.canPayCash}
          canPayUpiQr={initialOrder.canPayUpiQr}
          paymentMode={paymentMode}
          onPaid={() => {
            setPaymentStatus("PAID");
            setPaymentMode((mode) => mode);
          }}
        />
      )}

      {!isCancelled && isPaid && <PaidReceipt total={initialOrder.total} mode={paymentMode} />}

      {isCancelled ? (
        <div
          className="flex flex-col items-center gap-2 border p-6 text-center"
          style={{
            backgroundColor: "var(--resto-error-soft)",
            borderColor: "var(--resto-error)",
            borderRadius: "var(--resto-radius-lg)",
          }}
        >
          <CircleX className="size-8" style={{ color: "var(--resto-error)" }} aria-hidden />
          <p className="resto-display font-semibold" style={{ color: "var(--resto-text)" }}>
            Order cancelled
          </p>
          {cancelReason && (
            <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
              {cancelReason}
            </p>
          )}
          {paymentStatus === "REFUNDED" && (
            <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
              This order was already paid — a refund of {formatCurrency(initialOrder.total)} will be
              processed by the restaurant.
            </p>
          )}
        </div>
      ) : status === "COMPLETED" ? (
        <div
          className="flex flex-col items-center gap-2 border p-6 text-center"
          style={{
            backgroundColor: "var(--resto-success-soft)",
            borderColor: "var(--resto-success)",
            borderRadius: "var(--resto-radius-lg)",
          }}
        >
          <PartyPopper className="size-8" style={{ color: "var(--resto-success)" }} aria-hidden />
          <p className="resto-display font-semibold" style={{ color: "var(--resto-text)" }}>
            Thank you!
          </p>
          <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
            Thanks for ordering from {initialOrder.restaurantName}. We hope you enjoyed your meal.
          </p>
        </div>
      ) : (
        <>
        <ReadyEstimate placedAt={initialOrder.placedAt} items={initialOrder.items} />
        <ol
          className="flex flex-col gap-0 border p-5"
          style={{
            backgroundColor: "var(--resto-card)",
            borderColor: "var(--resto-border)",
            borderRadius: "var(--resto-radius-lg)",
          }}
        >
          {ORDER_STATUS_FLOW.map((step, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;

            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{
                      backgroundColor: done
                        ? "var(--resto-success)"
                        : active
                          ? "var(--resto-brand-500)"
                          : "transparent",
                      borderColor: done
                        ? "transparent"
                        : active
                          ? "var(--resto-brand-500)"
                          : "var(--resto-border)",
                      color: done ? "#fff" : active ? "var(--on-brand)" : "var(--resto-text-subtle)",
                    }}
                  >
                    {done ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : active ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Clock className="size-3.5" aria-hidden />
                    )}
                  </span>
                  {index < ORDER_STATUS_FLOW.length - 1 && (
                    <span
                      className="my-1 w-0.5 flex-1 rounded-full"
                      style={{
                        backgroundColor: done ? "var(--resto-success)" : "var(--resto-border)",
                      }}
                    />
                  )}
                </div>
                <div className={cn("pb-6", index === ORDER_STATUS_FLOW.length - 1 && "pb-0")}>
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: done || active ? "var(--resto-text)" : "var(--resto-text-muted)",
                    }}
                  >
                    {ORDER_STATUS_CUSTOMER_LABEL[step]}
                  </p>
                  {active && (
                    <p className="text-xs" style={{ color: "var(--resto-text-muted)" }}>
                      {STATUS_HINT[step]}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        </>
      )}

      {/* Asked only once the meal is actually over. Payment is no longer the
          cue: take-away and delivery orders are paid up front, so gating on
          it would ask a guest to rate food the kitchen has not yet cooked. */}
      {isCompleted && !hasReview && (
        <ReviewPrompt orderId={initialOrder.id} onSubmitted={() => setHasReview(true)} />
      )}

      <section
        className="border p-5"
        style={{
          backgroundColor: "var(--resto-card)",
          borderColor: "var(--resto-border)",
          borderRadius: "var(--resto-radius-lg)",
        }}
      >
        <h2
          className="mb-3 text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--resto-text-muted)" }}
        >
          Order summary
        </h2>
        <ul className="flex flex-col gap-2">
          {initialOrder.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="resto-numeric" style={{ color: "var(--resto-text-muted)" }}>
                  {item.quantity}×
                </span>{" "}
                <span style={{ color: "var(--resto-text)" }}>{item.name}</span>
                {(item.variantName || item.addOns.length > 0) && (
                  <span className="block text-xs" style={{ color: "var(--resto-text-muted)" }}>
                    {[item.variantName, ...item.addOns].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="resto-numeric shrink-0" style={{ color: "var(--resto-text)" }}>
                {formatCurrency(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>

        <div
          className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm"
          style={{ borderColor: "var(--resto-border)" }}
        >
          <SummaryRow label="Item total" value={initialOrder.subtotal} />
          {initialOrder.taxAmount > 0 && <SummaryRow label="Tax" value={initialOrder.taxAmount} />}
          {initialOrder.deliveryFee > 0 && (
            <SummaryRow label="Delivery fee" value={initialOrder.deliveryFee} />
          )}
          <div className="flex items-baseline justify-between font-semibold">
            <span style={{ color: "var(--resto-text)" }}>Grand total</span>
            <span className="resto-numeric resto-display" style={{ color: "var(--resto-text)" }}>
              {formatCurrency(initialOrder.total)}
            </span>
          </div>
        </div>

        {!isPaid && !awaitingPayment && !isCancelled && (
          <p
            className="mt-3 px-3 py-1.5 text-center text-xs font-medium"
            style={{
              backgroundColor: "var(--resto-surface-alt)",
              borderRadius: "var(--resto-radius-full)",
              color: "var(--resto-text-muted)",
            }}
          >
            Pay after your meal — the restaurant will open your invoice here.
          </p>
        )}

        {/* A plain <a download>, not a fetch-and-blob: the browser's own
            download handling is what a guest expects on a phone, and it works
            when the page's JavaScript doesn't.

            Shown only once paid — the API rejects the download until then
            (see /api/order/:orderId/invoice), so there is no point offering a
            link that would 404. The tracker already polls paymentStatus, so
            this appears on its own the moment staff mark the order paid,
            with no extra request needed. */}
        {isPaid && (
          <a
            href={`/api/order/${initialOrder.id}/invoice`}
            download
            className="mt-3 flex items-center justify-center gap-2 border py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--resto-surface-alt)]"
            style={{
              borderColor: "var(--resto-border)",
              borderRadius: "var(--resto-radius-full)",
              color: "var(--resto-text)",
            }}
          >
            <Download className="size-4" aria-hidden />
            Download invoice (PDF)
          </a>
        )}
      </section>

      <Link
        href={`/order/${initialOrder.restaurantSlug}`}
        className="self-center border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--resto-surface-alt)]"
        style={{
          borderColor: "var(--resto-border)",
          borderRadius: "var(--resto-radius-full)",
          color: "var(--resto-text)",
        }}
      >
        Order something else
      </Link>

      <PlatformCredit />
    </main>
  );
}

/** How often the countdown redraws. A minute-resolution figure needs no more. */
const ESTIMATE_TICK_MS = 30_000;

/**
 * "Ready in about 20 minutes", counting down from when the order was placed.
 *
 * Rendered only while the kitchen still has the order — the caller mounts this
 * inside the in-progress branch, so it disappears the moment the status turns
 * READY, COMPLETED or CANCELLED. That gate is the point: a countdown still
 * running beside "Ready — collect it" contradicts the food in front of the
 * guest, and the food wins.
 *
 * It ticks rather than rendering the estimate as placed. A figure that still
 * claimed twenty minutes after a guest had waited thirty would be worse than
 * saying nothing, which is exactly what happens when no dish carries a time.
 */
function ReadyEstimate({
  placedAt,
  items,
}: {
  placedAt: string;
  items: StatusOrder["items"];
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ESTIMATE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const quoted = estimateOrderMinutes(items);
  if (quoted == null) return null;

  const elapsed = Math.floor((now - new Date(placedAt).getTime()) / 60_000);
  const remaining = quoted - elapsed;

  return (
    <p
      className="flex items-center justify-center gap-2 border px-4 py-3 text-sm font-medium"
      role="status"
      style={{
        backgroundColor: "var(--resto-surface)",
        borderColor: "var(--resto-border)",
        borderRadius: "var(--resto-radius-md)",
        color: "var(--resto-text-muted)",
      }}
    >
      <Clock className="size-4 shrink-0" aria-hidden />
      {/* Past the estimate the honest thing is to stop counting. A negative
          number, or a stuck "1 min", both read as a broken screen. */}
      {remaining > 0 ? `Ready in about ${remaining} min` : "Should be ready any moment now"}
    </p>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span style={{ color: "var(--resto-text-muted)" }}>{label}</span>
      <span className="resto-numeric" style={{ color: "var(--resto-text)" }}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
