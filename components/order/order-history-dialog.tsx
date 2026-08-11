"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import {
  CustomerOrderList,
  type CustomerOrder,
} from "@/components/order/customer-order-list";
import type { PublicRestaurant } from "@/components/order/types";

/**
 * The signed-in guest's own orders.
 *
 * Unlike TrackOrderDialog there is no form: the mobile number is already in
 * the session cookie, so this opens straight into the list. That difference —
 * nothing to type — is the whole reason signing in is worth doing.
 */
export function OrderHistoryDialog({
  restaurant,
  customerName,
  onClose,
}: {
  restaurant: PublicRestaurant;
  customerName: string;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/order/customer-auth/orders?restaurantSlug=${encodeURIComponent(restaurant.slug)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("lookup failed");
        const data = await res.json();
        if (!cancelled) setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch {
        if (!cancelled) setError("Could not load your orders. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurant.slug]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="My orders"
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-[var(--resto-radius-xl)] sm:max-w-sm sm:rounded-[var(--resto-radius-xl)]"
        style={{
          backgroundColor: "var(--resto-surface)",
          border: "1px solid var(--resto-border)",
          boxShadow: "var(--resto-shadow-overlay)",
        }}
      >
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--resto-border)" }}
        >
          <div>
            <h2
              className="resto-display text-xl font-semibold"
              style={{ color: "var(--resto-text)" }}
            >
              My orders
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--resto-text-muted)" }}>
              Signed in as {customerName}.
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

          {!orders && !error && (
            <div className="flex items-center justify-center py-10">
              <Loader2
                className="size-5 animate-spin"
                style={{ color: "var(--resto-text-muted)" }}
                aria-label="Loading your orders"
              />
            </div>
          )}

          {orders && (
            <CustomerOrderList
              orders={orders}
              emptyMessage={`You haven't ordered from ${restaurant.name} yet.`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
