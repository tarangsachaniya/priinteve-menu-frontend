"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, IndianRupee, MessageCircle, RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { currentMonthKey, monthLabel, recentMonthKeys } from "@/lib/restaurant/whatsapp-usage";

export type WhatsappUsageData = {
  currentMonth: { count: number; charges: number };
  history: { month: string; count: number; charges: number }[];
};

type LedgerRow = {
  id: string;
  status: "SENT" | "FAILED";
  billable: boolean;
  unitPrice: string | number | null;
  recipientMobile: string;
  recipientName: string | null;
  failureReason: string | null;
  createdAt: string;
  order: { orderNumber: number } | null;
};

const PAGE_SIZE = 20;
const MONTH_OPTIONS = recentMonthKeys(6);

/**
 * Reused as-is on both the admin restaurant-detail page and the restaurant
 * owner's own Settings > WhatsApp page — `messagesEndpoint` and
 * `retryEndpoint` are the only things that differ between the two callers.
 */
export function WhatsappUsageView({
  initial,
  messagesEndpoint,
  retryEndpoint,
}: {
  initial: WhatsappUsageData;
  messagesEndpoint: string;
  retryEndpoint: (messageId: string) => string;
}) {
  const [month, setMonth] = useState(currentMonthKey());
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${messagesEndpoint}?month=${month}&page=${page}&pageSize=${PAGE_SIZE}`)
      .then((res) => (res.ok ? res.json() : { rows: [], total: 0 }))
      .then((data: { rows: LedgerRow[]; total: number }) => {
        if (cancelled) return;
        setRows(data.rows);
        setTotal(data.total);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [messagesEndpoint, month, page]);

  async function retry(messageId: string) {
    setRetrying(messageId);
    try {
      const res = await fetch(retryEndpoint(messageId), { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "Retry failed");
        return;
      }
      toast.success("Receipt resent");
      // Re-fetch the current page so the row's new status shows immediately.
      setPage((p) => p);
      const res2 = await fetch(`${messagesEndpoint}?month=${month}&page=${page}&pageSize=${PAGE_SIZE}`);
      if (res2.ok) {
        const data = (await res2.json()) as { rows: LedgerRow[]; total: number };
        setRows(data.rows);
        setTotal(data.total);
      }
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages this month</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initial.currentMonth.count.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Charges this month</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(initial.currentMonth.charges)}</div>
          </CardContent>
        </Card>
      </div>

      {initial.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" />
              Billing history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Charges</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.history.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell>{monthLabel(row.month)}</TableCell>
                    <TableCell>{row.count.toLocaleString()}</TableCell>
                    <TableCell>{formatCurrency(row.charges)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Messages</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {MONTH_OPTIONS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={key === month ? "default" : "outline"}
                onClick={() => {
                  setMonth(key);
                  setPage(0);
                }}
              >
                {key === currentMonthKey() ? "This month" : monthLabel(key)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No messages for {monthLabel(month)}.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Charge</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.order ? `#${row.order.orderNumber}` : "—"}</TableCell>
                      <TableCell>{row.recipientName ?? row.recipientMobile}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "SENT" ? "default" : "destructive"}>{row.status}</Badge>
                      </TableCell>
                      <TableCell>{row.unitPrice !== null ? formatCurrency(Number(row.unitPrice)) : "—"}</TableCell>
                      <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                      <TableCell>
                        {row.status === "FAILED" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={retrying === row.id}
                            onClick={() => void retry(row.id)}
                          >
                            <RotateCw className="size-3.5" />
                            {retrying === row.id ? "Retrying…" : "Retry"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={(page + 1) * PAGE_SIZE >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
