"use client";

import Link from "next/link";
import { PackageSearch } from "lucide-react";
import type { RestoOrderStatus, RestoPaymentStatus } from "@/lib/api/enums";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_CUSTOMER_LABEL } from "@/lib/restaurant/order-status";

export type CustomerOrder = {
  id: string;
  orderNumber: number;
  status: RestoOrderStatus;
  paymentStatus: RestoPaymentStatus;
  total: number;
  placedAt: string;
  statusUrl: string;
};

/**
 * One guest's recent orders at one restaurant.
 *
 * Shared by the mobile-number lookup and the signed-in history, which differ
 * only in how they find the orders — never in how they read. The empty line
 * is a prop because "we couldn't find that number" and "you haven't ordered
 * yet" are different messages for the same empty list.
 */
export function CustomerOrderList({
  orders,
  emptyMessage,
}: {
  orders: CustomerOrder[];
  emptyMessage: string;
}) {
  if (orders.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-2 border border-dashed py-8 text-center"
        style={{ borderColor: "var(--resto-border)", borderRadius: "var(--resto-radius-lg)" }}
      >
        <PackageSearch
          className="size-6"
          style={{ color: "var(--resto-text-subtle)" }}
          aria-hidden
        />
        <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={order.statusUrl}
            className="flex flex-col gap-1 border px-3 py-2.5 transition-colors hover:opacity-80"
            style={{
              backgroundColor: "var(--resto-card)",
              borderColor: "var(--resto-border)",
              borderRadius: "var(--resto-radius-md)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="resto-numeric text-sm font-semibold"
                style={{ color: "var(--resto-text)" }}
              >
                Order #{order.orderNumber}
              </span>
              <span
                className="resto-numeric text-sm font-medium"
                style={{ color: "var(--resto-text)" }}
              >
                {formatCurrency(order.total)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span style={{ color: "var(--resto-text-muted)" }}>
                {ORDER_STATUS_CUSTOMER_LABEL[order.status]}
              </span>
              <span style={{ color: "var(--resto-text-subtle)" }}>
                {formatDateTime(order.placedAt)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
