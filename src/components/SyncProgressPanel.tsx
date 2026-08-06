"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Job = {
  id: string;
  storeName: string;
  scope: string;
  phase: string;
  storeIndex: number;
  storeTotal: number;
  windowIndex: number;
  windowTotal: number;
  ordersDone: number;
  created: number;
  updated: number;
  partial: boolean;
  message: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

const POLL_ACTIVE_MS = 2_000; // ada sync jalan → sering, biar terasa hidup
const POLL_IDLE_MS = 10_000; // nganggur → jarang, hemat invocation

// Persentase kasar: gabungan posisi toko + posisi periode di dalam toko.
// Tidak akurat 100% (jumlah order belum diketahui di awal), tapi cukup untuk
// memberi tahu user bahwa ada kemajuan — dibanding spinner yang diam.
function percent(j: Job): number {
  if (j.finishedAt) return 100;
  const perStore = j.storeTotal > 0 ? 1 / j.storeTotal : 1;
  const doneStores = Math.max(0, j.storeIndex - 1) * perStore;
  const inStore = j.windowTotal > 0 ? (j.windowIndex / j.windowTotal) * perStore : 0;
  return Math.min(97, Math.round((doneStores + inStore) * 100));
}

function elapsed(startedAt: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  return s < 60 ? `${s} detik` : `${Math.floor(s / 60)} menit ${s % 60} detik`;
}

// Panel progres sync yang hidup: polling ke /api/sync/progress.
// Muncul sendiri saat ada sync jalan (termasuk yang dijalankan cron / tab lain),
// hilang sendiri beberapa detik setelah selesai.
export function SyncProgressPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [, setTick] = useState(0);
  const busy = useRef(false); // ada job jalan → polling dipercepat

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sync/progress", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { jobs?: Job[] };
      const next = d.jobs ?? [];
      busy.current = next.some((j) => !j.finishedAt);
      setJobs(next);
    } catch {
      // offline / navigasi — biarkan, putaran berikutnya coba lagi
    }
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    const loop = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") await load();
      if (stop) return;
      timer = setTimeout(loop, busy.current ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    };
    queueMicrotask(loop);

    // detik berjalan biar "sudah X detik" tetap hidup
    const tick = setInterval(() => setTick((t) => t + 1), 1_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3">
      {jobs.map((j) => {
        const running = !j.finishedAt;
        const failed = j.phase === "error";
        const pct = percent(j);
        const tone = failed
          ? { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", bar: "bg-red-500" }
          : running
            ? { border: "border-indigo-200", bg: "bg-indigo-50/60", text: "text-indigo-900", bar: "bg-indigo-500" }
            : j.partial
              ? { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-900", bar: "bg-amber-500" }
              : { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-900", bar: "bg-emerald-500" };

        return (
          <div key={j.id} className={`rounded-xl border ${tone.border} ${tone.bg} px-5 py-3.5`}>
            <div className="flex items-start gap-2.5">
              {failed ? (
                <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              ) : running ? (
                <RefreshCw size={18} className="mt-0.5 shrink-0 animate-spin text-indigo-500" />
              ) : j.partial ? (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
              ) : (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
              )}

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${tone.text}`}>
                  {j.scope === "ALL"
                    ? `Sync semua toko${j.storeTotal > 1 ? ` (${Math.max(1, j.storeIndex)}/${j.storeTotal})` : ""}`
                    : `Sync ${j.storeName}`}
                  {running && <span className="ml-1 font-normal opacity-70">· {elapsed(j.startedAt)}</span>}
                </p>
                <p className={`mt-0.5 text-xs ${tone.text} opacity-80`}>
                  {j.error ?? j.message ?? "Menyiapkan…"}
                </p>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                  <div
                    className={`h-full rounded-full ${tone.bar} transition-[width] duration-500`}
                    style={{ width: `${failed ? 100 : pct}%` }}
                  />
                </div>

                <p className={`mt-1.5 text-xs ${tone.text} opacity-70`}>
                  {j.ordersDone} order dipindai · {j.created} baru · {j.updated} diperbarui
                  {j.windowTotal > 0 && running ? ` · periode ${j.windowIndex}/${j.windowTotal}` : ""}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
