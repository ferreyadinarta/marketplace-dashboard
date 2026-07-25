"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Point = { tanggal: string; omzet: number; profit: number };

function juta(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}rb`;
  return String(v);
}

function tglPendek(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
}

export default function TrendChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="gOmzet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="tanggal"
          tickFormatter={tglPendek}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tickFormatter={juta}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          labelFormatter={(l) => tglPendek(String(l))}
          formatter={(v) =>
            new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
              Number(v)
            )
          }
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area type="monotone" dataKey="omzet" name="Omzet" stroke="#6366f1" strokeWidth={2} fill="url(#gOmzet)" />
        <Area
          type="monotone"
          dataKey="profit"
          name="Profit Bersih"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#gProfit)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
