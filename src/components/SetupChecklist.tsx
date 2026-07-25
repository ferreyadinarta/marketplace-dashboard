import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

type Step = { key: string; done: boolean; title: string; desc: string; href: string };

export default function SetupChecklist({
  steps,
  doneCount,
  total,
}: {
  steps: Step[];
  doneCount: number;
  total: number;
}) {
  const pct = Math.round((doneCount / total) * 100);
  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Langkah Awal</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Selesaikan langkah ini supaya pembukuan berjalan otomatis.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-indigo-600">
            {doneCount}/{total}
          </p>
          <p className="text-xs text-slate-400">selesai</p>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map((s, i) => (
          <Link
            key={s.key}
            href={s.href}
            className={`group flex items-start gap-3 rounded-xl border p-4 ${
              s.done
                ? "border-emerald-100 bg-emerald-50/50"
                : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm"
            }`}
          >
            {s.done ? (
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={20} />
            ) : (
              <Circle className="mt-0.5 shrink-0 text-slate-300" size={20} />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${s.done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                {i + 1}. {s.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{s.desc}</p>
            </div>
            {!s.done && (
              <ArrowRight
                size={16}
                className="mt-0.5 shrink-0 text-slate-300 group-hover:text-indigo-500"
              />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
