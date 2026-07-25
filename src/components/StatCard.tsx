import { rupiah } from "@/lib/format";

export default function StatCard({
  label,
  value,
  isCurrency = true,
  accent = "slate",
  hint,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
  accent?: "slate" | "blue" | "green" | "red" | "amber";
  hint?: string;
}) {
  const accentMap: Record<string, string> = {
    slate: "text-slate-900",
    blue: "text-blue-600",
    green: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accentMap[accent]}`}>
        {isCurrency ? rupiah(value) : value.toLocaleString("id-ID")}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
