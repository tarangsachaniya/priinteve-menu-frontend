"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, X } from "lucide-react";

import {
  clearResumeOrder,
  readResumeOrder,
  type ResumeOrder,
} from "@/lib/restaurant/order-recovery";

/**
 * Reminds a guest who already placed an order at this restaurant — and may
 * have since refreshed the menu or re-scanned the table QR — that it's still
 * in progress, with a shortcut back to its status page.
 *
 * Self-cleans: once the stored order turns out to be gone, cancelled, or
 * fully paid and completed, the localStorage entry is removed and nothing
 * renders. Dismissing the banner only hides it for this page view — the
 * underlying order isn't settled, so it should still show up next visit.
 */
export function ResumeOrderBanner({ slug }: { slug: string }) {
  const [order, setOrder] = useState<ResumeOrder | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = readResumeOrder(slug);
    if (!stored) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/order/${stored.orderId}/status`, { cache: "no-store" });
        if (!res.ok) {
          clearResumeOrder(slug);
          return;
        }

        const data = await res.json();
        // The status endpoint doesn't expose hasReview, so this is a looser
        // check than OrderStatusTracker's — good enough for "should we still
        // nag the guest to go back," which is this banner's only job.
        const settled =
          data.order.status === "CANCELLED" ||
          (data.order.status === "COMPLETED" && data.order.paymentStatus === "PAID");

        if (settled) {
          clearResumeOrder(slug);
          return;
        }

        if (!cancelled) setOrder(stored);
      } catch {
        // A dropped check isn't worth clearing the reminder over — the next
        // visit will try again.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!order || dismissed) return null;

  return (
    <div className="mx-auto mt-6 w-full max-w-[var(--resto-measure)] px-4">
      <div
        className="flex items-center gap-3 border px-4 py-3 text-sm font-medium"
        role="status"
        style={{
          backgroundColor: "var(--resto-brand-tint)",
          borderColor: "var(--resto-brand-tint-border)",
          borderRadius: "var(--resto-radius-md)",
          color: "var(--resto-brand-text)",
        }}
      >
        <PackageSearch className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">You have an order in progress — Order #{order.orderNumber}</span>
        <Link href={order.statusUrl} className="shrink-0 underline underline-offset-2 hover:no-underline">
          View status
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
