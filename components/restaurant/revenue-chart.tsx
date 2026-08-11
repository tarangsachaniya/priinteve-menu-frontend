"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrency } from "@/lib/format";

export type RevenuePoint = { label: string; revenue: number; orders: number };

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(var(--primary))" stopOpacity={0.45} />
            <stop offset="100%" stopColor="oklch(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          tickFormatter={(value: number) => `₹${value}`}
        />
        <Tooltip
          cursor={{ stroke: "oklch(var(--border))" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid oklch(var(--border))",
            background: "oklch(var(--card))",
            fontSize: 12,
          }}
          formatter={(value) => [formatCurrency(Number(value) || 0), "Revenue"]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="oklch(var(--primary))"
          strokeWidth={2}
          fill="url(#revenue-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
