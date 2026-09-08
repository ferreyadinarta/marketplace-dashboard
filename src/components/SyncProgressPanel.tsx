"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, ChevronDown, X, Clock } from "lucide-react";

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
  ordersTotal: number;
  round: number;
  created: number;
  updated: number;
  partial: boolean;
  message: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

const POLL_ACTIVE_MS = 2_000; // ada sync jalan → sering, biar terasa hidup
const POLL_IDLE_MS = 10_000; // baru buka / habis ada kegiatan → masih responsif
const POLL_SLEEP_MS = 60_000; // lama nganggur → jarang, tiap poll = query ke Neon
const IDLE_GRACE_MS = 2 * 60 * 1000;

// ordersTotal cuma menghitung periode yang SUDAH dilist (mis. 2 dari 25), jadi
// dia bukan total pekerjaan. Ukur dari posisi periode, dan pakai rasio order
// untuk mengisi progres DI DALAM periode yang sedang jalan.
function periodPercent(j: Job): number {
  if (j.windowTotal > 0) {
    const inWindow = j.ordersTotal > 0 ? Math.min(1, j.ordersDone / j.ordersTotal) : 0;
    const frac = (Math.max(0, j.windowIndex - 1) + inWindow) / j.windowTotal;
    return Math.min(97, Math.round(frac * 100));
  }
  if (j.ordersTotal > 0) return Math.min(97, Math.round((j.ordersDone / j.ordersTotal) * 100));
  return 0;
}

// selesai TOTAL = 100; selesai tapi masih ada sisa = masih di tengah jalan
function percent(j: Job): number {
  if (j.finishedAt && !j.partial && j.phase !== "error") return 100;
  return periodPercent(j);
}

// job yang masih berjalan ATAU sedang menunggu lanjutan otomatis — dua-duanya
// bagian dari SATU pekerjaan yang sama, jadi kartunya tidak boleh hilang
function inProgress(j: Job): boolean {
  return !j.finishedAt || (j.partial && j.phase === "done");
}

// semua periode sudah dilist → ordersTotal memang total pekerjaannya
function totalIsFinal(j: Job): boolean {
  return j.windowTotal > 0 && j.windowIndex >= j.windowTotal;
}

function shortDur(sec: number): string {
  if (sec < 60) return `${Math.max(5, Math.round(sec / 5) * 5)} detik`;
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} menit` : `${Math.floor(m / 60)} jam ${m % 60} menit`;
}

function elapsed(startedAt: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  return s < 60 ? `${s} detik` : `${Math.floor(s / 60)} menit ${s % 60} detik`;
}

function angka(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function title(j: Job): string {
  return j.scope === "ALL"
    ? `Mengambil penjualan semua toko${j.storeTotal > 1 ? ` (toko ${Math.max(1, j.storeIndex)} dari ${j.storeTotal})` : ""}`
    : `Mengambil penjualan ${j.storeName}`;
}

// per toko, bukan per job: tiap putaran bikin baris job baru
function jobKey(j: Job): string {
  return `${j.scope}|${j.storeName}`;
}

const HIDDEN_KEY = "syncPanelHidden";
const COLLAPSE_AT = 2; // lebih dari ini → daftar idle ditutup by default

// Panel progres sync yang hidup: polling ke /api/sync/progress.
// Muncul sendiri saat ada sync jalan (termasuk yang dijalankan cron / tab lain),
// hilang sendiri beberapa detik setelah selesai.
export function SyncProgressPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [, setTick] = useState(0);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showIdle, setShowIdle] = useState(false);
  const busy = useRef(false); // ada job jalan → polling dipercepat
  const lastBusy = useRef(Date.now()); // kapan terakhir ada tanda kehidupan
  const rate = useRef(new Map<string, { t: number; done: number; perSec: number }>());
  // tiap putaran = baris job baru dengan hitungan mulai 0; simpan capaian
  // tertinggi per toko biar barnya tidak mundur di awal putaran berikutnya
  const best = useRef(new Map<string, { done: number; total: number; pct: number; ids: Set<string> }>());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HIDDEN_KEY);
      if (raw) setHidden(JSON.parse(raw) as string[]);
    } catch {
      /* storage diblokir — biarkan tampil semua */
    }
  }, []);

  function dismiss(key: string) {
    setHidden((h) => {
      const next = h.includes(key) ? h : [...h, key];
      try {
        sessionStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      } catch {
        /* abaikan */
      }
      return next;
    });
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sync/progress", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { jobs?: Job[] };
      const next = d.jobs ?? [];
      busy.current = next.some((j) => !j.finishedAt);
      if (busy.current) lastBusy.current = Date.now();
      const now = Date.now();
      for (const j of next) {
        const k = jobKey(j);
        const b = best.current.get(k);
        // putaran 1 yang baru = sync baru → mulai dari nol lagi
        if (!b || (j.round <= 1 && !b.ids.has(j.id))) {
          best.current.set(k, {
            done: j.ordersDone,
            total: j.ordersTotal,
            pct: periodPercent(j),
            ids: new Set([j.id]),
          });
        } else {
          b.ids.add(j.id);
          b.done = Math.max(b.done, j.ordersDone);
          b.total = Math.max(b.total, j.ordersTotal);
          // tiap putaran mulai lagi dari periode 1, jadi barnya cuma boleh maju
          b.pct = Math.max(b.pct, periodPercent(j));
        }
      }
      for (const j of next) {
        const prev = rate.current.get(j.id);
        if (prev && j.ordersDone > prev.done && now > prev.t) {
          const inst = ((j.ordersDone - prev.done) * 1000) / (now - prev.t);
          rate.current.set(j.id, {
            t: now,
            done: j.ordersDone,
            perSec: prev.perSec ? prev.perSec * 0.7 + inst * 0.3 : inst,
          });
        } else if (!prev) {
          rate.current.set(j.id, { t: now, done: j.ordersDone, perSec: 0 });
        }
      }
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
      const idleFor = Date.now() - lastBusy.current;
      const wait = busy.current
        ? POLL_ACTIVE_MS
        : idleFor < IDLE_GRACE_MS
          ? POLL_IDLE_MS
          : POLL_SLEEP_MS;
      timer = setTimeout(loop, wait);
    };
    queueMicrotask(loop);

    // "sudah X detik" cuma perlu jalan saat ada job
    const tick = setInterval(() => busy.current && setTick((t) => t + 1), 1_000);
    const wake = () => {
      lastBusy.current = Date.now();
      clearTimeout(timer);
      void loop();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") wake();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("sync:started", wake);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("sync:started", wake);
    };
  }, [load]);

  // yang jalan = kartu penuh, sisanya satu baris ringkas biar tidak makan layar
  const running = jobs.filter(inProgress);
  const idle = jobs.filter((j) => !inProgress(j) && !hidden.includes(jobKey(j)));
  if (running.length === 0 && idle.length === 0) return null;

  const collapsed = idle.length > COLLAPSE_AT && !showIdle;

  return (
    <div className="space-y-3">
      {running.map((j) => {
        const b = best.current.get(jobKey(j));
        const done = Math.max(j.ordersDone, b?.done ?? 0);
        const totalOrders = Math.max(j.ordersTotal, b?.total ?? 0);
        const finalTotal = totalIsFinal(j);
        const sisa = Math.max(0, totalOrders - done);
        const perSec = rate.current.get(j.id)?.perSec ?? 0;
        // ETA cuma jujur kalau totalnya sudah pasti
        const eta = finalTotal && sisa > 0 && perSec > 0.2 ? shortDur(sisa / perSec) : null;
        const waiting = !!j.finishedAt; // selesai satu bagian, menunggu lanjutan
        const pct = Math.max(percent(j), b?.pct ?? 0);
        return (
        <div key={j.id} className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-5 py-3.5">
          <div className="flex items-start gap-2.5">
            {waiting ? (
              <Clock size={18} className="mt-0.5 shrink-0 text-indigo-400" />
            ) : (
              <RefreshCw size={18} className="mt-0.5 shrink-0 animate-spin text-indigo-500" />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-indigo-900">
                {title(j)}
                <span className="ml-1 font-normal opacity-70">
                  {waiting ? `· menunggu ${elapsed(j.finishedAt ?? j.startedAt)}` : `· berjalan ${elapsed(j.startedAt)}`}
                  {!waiting && eta ? ` · kira-kira ${eta} lagi` : ""}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-indigo-900 opacity-80">
                {waiting
                  ? "Lanjut sendiri tiap ~15 menit. Halaman boleh ditutup — atau klik Sync lagi kalau mau langsung lanjut."
                  : (j.error ?? j.message ?? "Menyiapkan…")}
                {j.windowTotal > 1 && !j.error ? ` (bagian ${j.windowIndex} dari ${j.windowTotal})` : ""}
              </p>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="mt-1.5 text-xs text-indigo-900 opacity-70">
                {finalTotal && totalOrders > 0
                  ? `${angka(done)} dari ${angka(totalOrders)} pesanan diperiksa · sisa ${angka(sisa)}`
                  : `${angka(done)} pesanan diperiksa`}
                {j.created > 0 ? ` · ${angka(j.created)} pesanan baru masuk` : ""}
                {j.updated > 0 ? ` · ${angka(j.updated)} datanya diperbarui` : ""}
              </p>
            </div>
          </div>
        </div>
        );
      })}

      {idle.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {idle.length > COLLAPSE_AT && (
            <button
              type="button"
              onClick={() => setShowIdle((s) => !s)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <span>{idle.length} pengambilan data lain</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${collapsed ? "" : "rotate-180"}`} />
            </button>
          )}

          {!collapsed &&
            idle.map((j) => {
              const failed = j.phase === "error";
              const Icon = failed ? XCircle : j.partial ? AlertTriangle : CheckCircle2;
              const tint = failed ? "text-red-500" : j.partial ? "text-amber-500" : "text-emerald-500";

              return (
                <div
                  key={j.id}
                  className="flex items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 first:border-t-0"
                >
                  <Icon size={15} className={`shrink-0 ${tint}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">
                      {title(j)}
                      <span className="ml-1.5 font-normal text-slate-400">
                        {angka(j.created)} baru · {angka(j.updated)} diperbarui
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {j.error ??
                        (j.partial
                          ? "Masih ada sisa — lanjut sendiri tiap ~15 menit, atau klik Sync lagi."
                          : (j.message ?? "Selesai"))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(jobKey(j))}
                    aria-label="Sembunyikan"
                    className="shrink-0 rounded-md p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
