import type { ReactNode } from "react";
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
}: {
  label: string;
  value: number;
  icon: ReactNode;
  isCurrency?: boolean;
  accent?: keyof typeof accents;
  hint?: string;
  help?: string;
}) {
  const a = accents[accent];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="flex items-center text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
          {help && <HelpHint text={help} />}
        </p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.ring} ${a.icon}`}>
          {icon}
        </div>
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${a.value}`}>
        {isCurrency ? rupiah(value) : value.toLocaleString("id-ID")}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
