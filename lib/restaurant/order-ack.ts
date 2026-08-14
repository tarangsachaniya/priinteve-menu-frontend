import type { RestoOrderStatus } from "@/lib/api/enums";

/**
 * The same-machine "this order has been dealt with" channel.
 *
 * WHY IT EXISTS: the damru now rings until an order leaves PLACED, and the
 * authority on that is the server. But the poll that reads the server runs at
 * five seconds, and a staff member who has just tapped Accept should not be
 * rewarded with five more seconds of drumming. This channel closes that gap —
 * the alert provider drops the order from its ring the instant the PATCH
 * returns, and the poll confirms it a moment later.
 *
 * TWO TRANSPORTS, BOTH FIRED ON EVERY PUBLISH:
 *
 *   CustomEvent      the same document. This is the primary case — the orders
 *                    board and the alert provider live in one React tree — and
 *                    it is exactly the case BroadcastChannel does NOT cover,
 *                    because a BroadcastChannel deliberately does not deliver a
 *                    message back to the context that posted it.
 *   BroadcastChannel other tabs in the same browser. A till with the board open
 *                    in one tab and the kitchen screen in another is normal, and
 *                    without this the second tab keeps drumming.
 *
 * Neither reaches another device, and that is deliberate. Stopping a drum on a
 * manager's phone is the poll's job. A client-to-client message doing it too
 * would be a second source of truth to keep in step with the first.
 *
 * NO DEDUPE, BY CONSTRUCTION. A subscriber's only reaction is to add an id to a
 * set and filter a list, so receiving the same ack twice costs nothing. That is
 * why there are no message ids here.
 */

const CHANNEL_NAME = "pv:resto:order-ack";

export type OrderAck = {
  orderId: string;
  /**
   * What the order was moved to.
   *
   * NOT authoritative, and subscribers must not store it as though it were: on
   * a 409 the publisher sends the status it *attempted*, because all it knows
   * is that the order is no longer where it thought. The next poll is the
   * authority. Consumers that only need "stop ringing about this one" should
   * read `orderId` and ignore this.
   */
  status: RestoOrderStatus;
};

type Listener = (ack: OrderAck) => void;

/**
 * One shared channel per page, opened on the first subscriber and closed after
 * the last one leaves. A BroadcastChannel held open by an unmounted component
 * is a leak, and these components mount and unmount across route changes.
 */
let channel: BroadcastChannel | null = null;
let subscriberCount = 0;

function supportsBroadcast(): boolean {
  return typeof window !== "undefined" && typeof window.BroadcastChannel === "function";
}

export function publishOrderAck(ack: OrderAck): void {
  if (typeof window === "undefined") return;

  // Same document first, and unconditionally. Everything below can fail on a
  // locked-down browser; this cannot, and it is the path that matters most.
  window.dispatchEvent(new CustomEvent<OrderAck>(CHANNEL_NAME, { detail: ack }));

  if (!supportsBroadcast()) return;
  try {
    // A throwaway channel rather than the shared one above: publishing has to
    // work from a component that never subscribed (the orders board is a
    // publisher only), and opening one for the length of a postMessage is
    // cheaper than refcounting a second reference into the shared channel.
    const out = new BroadcastChannel(CHANNEL_NAME);
    out.postMessage(ack);
    out.close();
  } catch {
    // Some privacy modes refuse to construct one. The same-document dispatch
    // above has already fired.
  }
}

export function subscribeOrderAck(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};

  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent<OrderAck>).detail;
    if (detail?.orderId) listener(detail);
  };
  window.addEventListener(CHANNEL_NAME, onEvent);

  let onMessage: ((event: MessageEvent<OrderAck>) => void) | null = null;
  if (supportsBroadcast()) {
    try {
      if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
      subscriberCount += 1;
      onMessage = (event) => {
        if (event.data?.orderId) listener(event.data);
      };
      channel.addEventListener("message", onMessage as EventListener);
    } catch {
      onMessage = null;
    }
  }

  return () => {
    window.removeEventListener(CHANNEL_NAME, onEvent);
    if (!onMessage || !channel) return;

    channel.removeEventListener("message", onMessage as EventListener);
    subscriberCount -= 1;
    if (subscriberCount <= 0) {
      channel.close();
      channel = null;
      subscriberCount = 0;
    }
  };
}
