"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, ChevronDown, X, Clock } from "lucide-react";
import { useT } from "@/components/LangProvider";
import type { T } from "@/lib/i18n";

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

function shortDur(sec: number, t: T): string {
  if (sec < 60) return `${Math.max(5, Math.round(sec / 5) * 5)} ${t("detik", "sec")}`;
  const m = Math.round(sec / 60);
  return m < 60
    ? `${m} ${t("menit", "min")}`
    : `${Math.floor(m / 60)} ${t("jam", "hr")} ${m % 60} ${t("menit", "min")}`;
}

function elapsed(startedAt: string, t: T): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  return s < 60
    ? `${s} ${t("detik", "sec")}`
    : `${Math.floor(s / 60)} ${t("menit", "min")} ${s % 60} ${t("detik", "sec")}`;
}

function angka(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function title(j: Job, t: T): string {
  return j.scope === "ALL"
    ? t("Mengambil penjualan semua toko", "Fetching sales for all stores") +
        (j.storeTotal > 1
          ? ` (${t("toko", "store")} ${Math.max(1, j.storeIndex)} ${t("dari", "of")} ${j.storeTotal})`
          : "")
    : t(`Mengambil penjualan ${j.storeName}`, `Fetching sales for ${j.storeName}`);
}

// Pesan dari syncRunner.ts/syncProgress.ts (lib tanpa konteks request) datang
// sebagai satu string Indonesia. Cocokkan pola yang dikenal untuk diterjemahkan;
// pesan dari lib lain (mis. shopee/tiktok) dibiarkan apa adanya.
function translateSyncText(msg: string | null | undefined, t: T): string | null {
  if (!msg) return msg ?? null;

  if (msg === "Menyiapkan…") return t(msg, "Preparing…");

  let m = msg.match(/^Selesai: (\d+) baru, (\d+) diperbarui$/);
  if (m) return t(msg, `Done: ${m[1]} new, ${m[2]} updated`);

  m = msg.match(/^Putaran (\d+) selesai: (\d+) baru, (\d+) diperbarui\. Sisanya dilanjutkan otomatis$/);
  if (m) return t(msg, `Round ${m[1]} done: ${m[2]} new, ${m[3]} updated. The rest continues automatically`);

  m = msg.match(/^Putaran (\d+) selesai: (\d+) baru, (\d+) diperbarui\. Sudah (\d+) putaran, klik Sync lagi kalau masih ada sisa$/);
  if (m)
    return t(
      msg,
      `Round ${m[1]} done: ${m[2]} new, ${m[3]} updated. Reached ${m[4]} rounds, click Sync again if there's more`
    );

  m = msg.match(/^Gagal: (.+)$/);
  if (m) return t(msg, `Failed: ${m[1]}`);

  return msg;
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
  const t = useT();
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
  const rest = jobs.filter((j) => !inProgress(j) && !hidden.includes(jobKey(j)));
  // baru saja tuntas → tampilkan penuh, jangan diselipkan ke daftar ringkas
  const JUST_DONE_MS = 3 * 60 * 1000;
  const justDone = rest.filter(
    (j) =>
      j.phase !== "error" &&
      !j.partial &&
      j.finishedAt &&
      Date.now() - new Date(j.finishedAt).getTime() < JUST_DONE_MS
  );
  const idle = rest.filter((j) => !justDone.includes(j));
  if (running.length === 0 && idle.length === 0 && justDone.length === 0) return null;

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
        const eta = finalTotal && sisa > 0 && perSec > 0.2 ? shortDur(sisa / perSec, t) : null;
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
                {title(j, t)}
                <span className="ml-1 font-normal opacity-70">
                  {waiting
                    ? `· ${t("menunggu", "waiting")} ${elapsed(j.finishedAt ?? j.startedAt, t)}`
                    : `· ${t("berjalan", "running")} ${elapsed(j.startedAt, t)}`}
                  {!waiting && eta ? ` · ${t("kira-kira", "about")} ${eta} ${t("lagi", "left")}` : ""}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-indigo-900 opacity-80">
                {waiting
                  ? t(
                      "Lanjut sendiri tiap ~15 menit. Halaman boleh ditutup, atau klik Sync lagi kalau mau langsung lanjut.",
                      "Continues on its own every ~15 minutes. You can close this page, or click Sync again to continue right away."
                    )
                  : (translateSyncText(j.error, t) ?? translateSyncText(j.message, t) ?? t("Menyiapkan…", "Preparing…"))}
                {j.windowTotal > 1 && !j.error ? ` (${t("bagian", "part")} ${j.windowIndex} ${t("dari", "of")} ${j.windowTotal})` : ""}
              </p>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="mt-1.5 text-xs text-indigo-900 opacity-70">
                {finalTotal && totalOrders > 0
                  ? `${angka(done)} ${t("dari", "of")} ${angka(totalOrders)} ${t("pesanan diperiksa", "orders checked")} · ${t("sisa", "left")} ${angka(sisa)}`
                  : `${angka(done)} ${t("pesanan diperiksa", "orders checked")}`}
                {j.created > 0 ? ` · ${angka(j.created)} ${t("pesanan baru masuk", "new orders")}` : ""}
                {j.updated > 0 ? ` · ${angka(j.updated)} ${t("datanya diperbarui", "updated")}` : ""}
              </p>
            </div>
          </div>
        </div>
        );
      })}

      {justDone.map((j) => (
        <div key={j.id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-900">
                {j.scope === "ALL"
                  ? t("Semua toko selesai diambil", "All stores finished fetching")
                  : t(`${j.storeName} selesai diambil`, `${j.storeName} finished fetching`)}
              </p>
              <p className="mt-0.5 text-xs text-emerald-900 opacity-80">
                {j.created > 0 || j.updated > 0
                  ? `${angka(j.created)} ${t("pesanan baru masuk", "new orders")} · ${angka(j.updated)} ${t("datanya diperbarui", "updated")}`
                  : t("Tidak ada pesanan baru.", "No new orders.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(jobKey(j))}
              aria-label={t("Tutup", "Close")}
              className="shrink-0 rounded-md p-1 text-emerald-400 transition hover:bg-emerald-100 hover:text-emerald-700"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}

      {idle.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {idle.length > COLLAPSE_AT && (
            <button
              type="button"
              onClick={() => setShowIdle((s) => !s)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <span>{idle.length} {t("pengambilan data lain", "other data fetches")}</span>
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
                      {title(j, t)}
                      <span className="ml-1.5 font-normal text-slate-400">
                        {angka(j.created)} {t("baru", "new")} · {angka(j.updated)} {t("diperbarui", "updated")}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {translateSyncText(j.error, t) ??
                        (j.partial
                          ? t(
                              "Masih ada sisa. Lanjut sendiri tiap ~15 menit, atau klik Sync lagi.",
                              "There's more left. Continues on its own every ~15 minutes, or click Sync again."
                            )
                          : (translateSyncText(j.message, t) ?? t("Selesai", "Done")))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(jobKey(j))}
                    aria-label={t("Sembunyikan", "Hide")}
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
