import type { RestoOrderStatus } from "@/lib/api/enums";
import { CONSOLE_ORDERS_PATH } from "@/lib/restaurant/live-order";
import { publishOrderAck } from "@/lib/restaurant/order-ack";

/**
 * The one way this app changes an order's status.
 *
 * WHY IT IS A FUNCTION AND NOT A CONVENTION: the damru rings until an order
 * leaves PLACED, and it stops early because a successful PATCH publishes an ack
 * (see order-ack.ts). Three screens now move orders — the board, the kitchen
 * display and the alert popup — and a rule that says "remember to publish an
 * ack after every PATCH" will be forgotten at the fourth. Folding the ack into
 * the request makes forgetting it impossible.
 */

export type StatusPatchResult = {
  ok: boolean;
  error?: string;
  /** The order had already moved on — another device got there first. */
  conflict?: boolean;
};

export async function patchOrderStatus(
  orderId: string,
  status: RestoOrderStatus,
  cancelReason?: string,
  /**
   * Which orders API to write through. The console uses the staff-session one;
   * a mounted kitchen screen passes /api/screen/<token>/orders, which is reached
   * with a link and a PIN instead. Both speak the same request and response, so
   * every caller above this is identical either way.
   */
  basePath: string = CONSOLE_ORDERS_PATH,
): Promise<StatusPatchResult> {
  try {
    const res = await fetch(`${basePath}/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancelReason }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };

    if (res.ok) {
      publishOrderAck({ orderId, status });
      return { ok: true };
    }

    /**
     * A 409 from this endpoint is the transition map refusing, which means the
     * order is no longer where the caller thought it was — another till or
     * another device already accepted or cancelled it.
     *
     * The mutation failed, but the reason the drum was ringing is gone, so it
     * still has to be acked. Skipping this leaves a console drumming forever
     * over an order somebody else already dealt with, which is the exact
     * failure this whole feature would be blamed for.
     */
    if (res.status === 409) {
      publishOrderAck({ orderId, status });
      return {
        ok: false,
        conflict: true,
        error: typeof data.error === "string" ? data.error : "This order has already moved on",
      };
    }

    return { ok: false, error: typeof data.error === "string" ? data.error : "Could not update the order" };
  } catch {
    // A dropped network is not an acknowledgement. No ack is published, so the
    // drum keeps going — correct, because nothing changed on the server.
    return { ok: false, error: "Could not reach the server" };
  }
}
