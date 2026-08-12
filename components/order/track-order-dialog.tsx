"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { extractNationalDigits, INDIAN_MOBILE_REGEX } from "@/lib/restaurant/mobile";
import {
  CustomerOrderList,
  type CustomerOrder,
} from "@/components/order/customer-order-list";
import { OverlayShell } from "@/components/order/overlay-shell";
import type { PublicRestaurant } from "@/components/order/types";

/**
 * No-login fallback for a guest who placed an order on a different device,
 * or whose local storage got cleared — so Task 1's resume banner has nothing
 * to show. Looks up recent orders by mobile number instead of a stored id.
 */
export function TrackOrderDialog({
  restaurant,
  onClose,
}: {
  restaurant: PublicRestaurant;
  onClose: () => void;
}) {
  const [mobile, setMobile] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);

  const nationalDigits = extractNationalDigits(mobile);
  const mobileValid = INDIAN_MOBILE_REGEX.test(nationalDigits);
  const mobileTouched = mobile.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mobileValid) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/order/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug: restaurant.slug, mobile: nationalDigits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong. Please try again.");
        setOrders(null);
        return;
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setError("Something went wrong. Please try again.");
      setOrders(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <OverlayShell tone="lookup" label="Track my order" onClose={onClose}>
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--resto-border)" }}
        >
          <div>
            <h2 className="resto-display text-xl font-semibold" style={{ color: "var(--resto-text)" }}>
              Track my order
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--resto-text-muted)" }}>
              Look up your recent orders by mobile number.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--resto-text-muted)" }}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="track-order-mobile"
                className="text-sm font-medium"
                style={{ color: "var(--resto-text)" }}
              >
                Mobile number
              </label>
              <div className="flex items-center gap-2">
                <span
                  className="flex h-10 items-center px-3 text-sm"
                  style={{
                    backgroundColor: "var(--resto-surface-alt)",
                    borderRadius: "var(--resto-radius-md)",
                    color: "var(--resto-text-muted)",
                  }}
                >
                  +91
                </span>
                <input
                  id="track-order-mobile"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={13}
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value);
                    setOrders(null);
                    setError(null);
                  }}
                  aria-invalid={mobileTouched && !mobileValid}
                  className="h-10 w-full border px-3 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--resto-card)",
                    borderColor: "var(--resto-border)",
                    borderRadius: "var(--resto-radius-md)",
                    color: "var(--resto-text)",
                  }}
                />
              </div>
              {mobileTouched && !mobileValid && (
                <p className="text-xs" style={{ color: "var(--resto-error)" }}>
                  Enter a 10-digit number starting with 6, 7, 8 or 9.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!mobileValid || isLoading}
              className="resto-numeric flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--resto-brand-500)",
                color: "var(--on-brand)",
                borderRadius: "var(--resto-radius-full)",
              }}
            >
              {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {isLoading ? "Searching…" : "Find my orders"}
            </button>
          </form>

          {error && (
            <p
              className="px-3 py-2 text-sm"
              role="alert"
              style={{
                backgroundColor: "var(--resto-error-soft)",
                borderRadius: "var(--resto-radius-md)",
                color: "var(--resto-error)",
              }}
            >
              {error}
            </p>
          )}

          {orders && (
            <CustomerOrderList
              orders={orders}
              emptyMessage="No recent orders found for this number."
            />
          )}
        </div>
    </OverlayShell>
  );
}
