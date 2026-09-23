import Link from "next/link";
import { Check } from "lucide-react";
import { getT } from "@/lib/i18n-server";

type Step = { key: string; done: boolean; title: string; desc: string; href: string; cta: string };

// Stepper terpandu: cuma langkah yang sedang aktif yang punya tombol, jadi user
// selalu tahu satu hal berikutnya yang harus dikerjakan.
export default async function SetupChecklist({
  steps,
  doneCount,
  total,
}: {
  steps: Step[];
  doneCount: number;
  total: number;
}) {
  const { t } = await getT();
  const current = steps.findIndex((s) => !s.done);

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t("Siapkan pembukuan", "Set up bookkeeping")}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              "Ikuti urutannya. Angka profit baru benar setelah semua selesai.",
              "Follow the steps in order. Profit numbers are only accurate once everything is done."
            )}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-indigo-600">
          {t(`${doneCount} dari ${total}`, `${doneCount} of ${total}`)}
        </p>
      </div>

      <ol className="px-5 py-3">
        {steps.map((s, i) => {
          const isCurrent = i === current;
          return (
            <li key={s.key} className="relative flex gap-3 py-2">
              {/* garis penghubung antar langkah */}
              {i < steps.length - 1 && (
                <span
                  className={`absolute left-[11px] top-9 bottom-[-8px] w-px ${s.done ? "bg-emerald-200" : "bg-slate-200"}`}
                  aria-hidden
                />
              )}
              <span
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  s.done
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-300 bg-white text-slate-400"
                }`}
              >
                {s.done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`text-sm ${
                    s.done ? "text-slate-400" : isCurrent ? "font-semibold text-slate-900" : "text-slate-500"
                  }`}
                >
                  {s.title}
                </p>
                {isCurrent && (
                  <div className="animate-reveal">
                    <p className="mt-0.5 text-xs text-slate-500">{s.desc}</p>
                    <Link
                      href={s.href}
                      className="mt-2.5 inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                    >
                      {s.cta}
                    </Link>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
