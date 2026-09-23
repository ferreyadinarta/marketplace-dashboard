import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { rupiah } from "@/lib/format";
import { HelpHint } from "@/components/ui";

const accents: Record<string, { ring: string; icon: string; value: string }> = {
  blue: { ring: "bg-blue-50", icon: "text-blue-600", value: "text-slate-900" },
  green: { ring: "bg-emerald-50", icon: "text-emerald-600", value: "text-emerald-600" },
  red: { ring: "bg-red-50", icon: "text-red-600", value: "text-slate-900" },
  amber: { ring: "bg-amber-50", icon: "text-amber-600", value: "text-slate-900" },
};

export default function StatCard({
  label,
  value,
  icon,
  isCurrency = true,
  accent = "blue",
  hint,
  help,
  deltaPct,
  deltaGoodWhenUp = true,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  isCurrency?: boolean;
  accent?: keyof typeof accents;
  hint?: string;
  help?: string;
  deltaPct?: number | null; // % perubahan vs periode sebelumnya (null = tak ada pembanding)
  deltaGoodWhenUp?: boolean; // naik = bagus? (profit ya, fee tidak)
}) {
  const a = accents[accent];

  const hasDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct);
  const up = hasDelta && (deltaPct as number) >= 0;
  const good = hasDelta && (up ? deltaGoodWhenUp : !deltaGoodWhenUp);
  const deltaColor = good ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center text-sm font-medium text-slate-500">
          {label}
          {help && <HelpHint text={help} />}
        </p>
        <div className={`hidden h-9 w-9 items-center sm:flex justify-center rounded-xl ${a.ring} ${a.icon}`}>
          {icon}
        </div>
      </div>
      <p className={`mt-2 text-lg font-bold tracking-tight tabular-nums sm:mt-3 sm:text-2xl ${a.value}`}>
        {isCurrency ? rupiah(value) : value.toLocaleString("id-ID")}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${deltaColor}`}>
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(deltaPct as number).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
    </div>
  );
}
