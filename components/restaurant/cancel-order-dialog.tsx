"use client";

import { useState } from "react";

import type { RestoPaymentStatus } from "@/lib/api/enums";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";

/**
 * Replaces the native prompt() the cancel action used to open — same reason
 * confirm() was replaced elsewhere: it blocks the render thread and can't be
 * styled or made keyboard/screen-reader friendly like the rest of the app.
 *
 * Lifted out of orders-board.tsx when the alert popup and the kitchen display
 * both grew a Reject button. Three copies of a cancellation dialog would be
 * three places to keep the refund warning correct.
 */

/**
 * Deliberately a structural subset rather than BoardOrder, because the three
 * screens that cancel orders know different amounts about them:
 *
 *   board          everything
 *   alert popup    number and total, but not payment state
 *   kitchen screen neither — /api/screen/<token>/orders withholds money from a
 *                  device that unlocked with a PIN rather than a login
 *
 * Demanding the full DTO would mean two of those inventing fields to satisfy a
 * type, and the kitchen one inventing a total it is specifically not trusted
 * with.
 *
 * Nothing is lost by the omissions. A PLACED order is always PENDING —
 * request-payment refuses to run before ACCEPTED (see orders.routes.ts) — so
 * the refund warning below can never apply to a caller that omits the field.
 */
export type CancellableOrder = {
  id: string;
  orderNumber: number;
  total?: number;
  paymentStatus?: RestoPaymentStatus;
};

export function CancelOrderDialog({
  order,
  onOpenChange,
  onConfirm,
}: {
  order: CancellableOrder | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={order !== null}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel order?</DialogTitle>
          <DialogDescription>
            {order && `Let the kitchen know why order #${order.orderNumber} is being cancelled.`}
          </DialogDescription>
        </DialogHeader>
        {order?.paymentStatus === "PAID" && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            This order has already been paid
            {order.total === undefined ? "" : ` (${formatCurrency(order.total)})`}. Cancelling it will
            mark it as Refunded — you&apos;ll still need to process the actual refund yourself.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea
            id="cancel-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Out of stock, guest changed their mind…"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Keep order
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
          >
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
