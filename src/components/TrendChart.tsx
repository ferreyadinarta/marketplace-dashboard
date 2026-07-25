"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Point = { tanggal: string; omzet: number; profit: number };

function juta(v: number) {
  return `${(v / 1_000_000).toFixed(1)}jt`;
}

export default function TrendChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} stroke="#94a3b8" minTickGap={24} />
        <YAxis tickFormatter={juta} tick={{ fontSize: 11 }} stroke="#94a3b8" width={48} />
        <Tooltip
          formatter={(v) =>
            new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
              Number(v)
            )
          }
        />
        <Legend />
        <Line type="monotone" dataKey="omzet" name="Omzet" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="profit" name="Profit Bersih" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
