import type { RestoOrderStatus, RestoOrderType, RestoPaymentStatus } from "@/lib/api/enums";

/** Kitchen-facing order lifecycle, and the transitions the API will accept. */

export const ORDER_STATUS_FLOW: RestoOrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

/**
 * The statuses the orders board is for — everything still in the kitchen.
 * Closed orders live on /r/history instead. Shared so the board's page and its
 * polling endpoint can't drift into disagreeing about what "live" means.
 */
export const LIVE_STATUSES: RestoOrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
];

export const ORDER_STATUS_LABEL: Record<RestoOrderStatus, string> = {
  PLACED: "New",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Customer-facing wording — "New" means nothing to the person who ordered. */
export const ORDER_STATUS_CUSTOMER_LABEL: Record<RestoOrderStatus, string> = {
  PLACED: "Order placed",
  ACCEPTED: "Confirmed by restaurant",
  PREPARING: "Being prepared",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_BADGE: Record<RestoOrderStatus, string> = {
  PLACED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  ACCEPTED: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  PREPARING: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  READY: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

/**
 * Orders move forward one step at a time, and may be cancelled from any
 * state that isn't already terminal. No going backwards: a kitchen that has
 * started cooking can't un-accept.
 */
const ALLOWED_TRANSITIONS: Record<RestoOrderStatus, RestoOrderStatus[]> = {
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: RestoOrderStatus, to: RestoOrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Whether the bill is actually settled. Kept separate from canTransition —
 * kitchen status and payment status are independent facts (see the request-
 * payment and pay routes), so this is checked at the point of use rather than
 * folded into the status transition map.
 */
export function isSettled(paymentStatus: RestoPaymentStatus): boolean {
  return paymentStatus === "PAID";
}

export function nextStatus(from: RestoOrderStatus): RestoOrderStatus | null {
  const index = ORDER_STATUS_FLOW.indexOf(from);
  if (index === -1 || index === ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[index + 1];
}

/** Maps a status change to the timestamp column it should stamp. */
export function timestampFieldFor(status: RestoOrderStatus): string | null {
  switch (status) {
    case "ACCEPTED":
      return "acceptedAt";
    case "PREPARING":
      return "preparingAt";
    case "READY":
      return "readyAt";
    case "COMPLETED":
      return "completedAt";
    case "CANCELLED":
      return "cancelledAt";
    default:
      return null;
  }
}

export const ORDER_TYPE_LABEL: Record<RestoOrderType, string> = {
  DINE_IN: "Dine-In",
  TAKE_AWAY: "Take Away",
  DELIVERY: "Delivery",
};

/** Owner-facing wording, for the board and the order list. */
export const PAYMENT_STATUS_LABEL: Record<RestoPaymentStatus, string> = {
  PENDING: "Bill open",
  REQUESTED: "Bill closed — awaiting payment",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

/**
 * Customer-facing wording. "Bill open" is restaurant vocabulary and means
 * nothing to the person eating — from their side the useful distinction is
 * whether they are being asked for money yet.
 */
export const PAYMENT_STATUS_CUSTOMER_LABEL: Record<RestoPaymentStatus, string> = {
  PENDING: "Pay after your meal",
  REQUESTED: "Ready to pay",
  PAID: "Paid",
  FAILED: "Payment failed — try again or pay at the counter",
  REFUNDED: "Refunded",
};
