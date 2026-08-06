"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Pause } from "lucide-react";
import { Select, type SelectOption } from "@/components/Select";

// periode order yang ditarik dari Shopee
const RANGE_OPTIONS: SelectOption[] = [
  { value: "30", label: "30 hari" },
  { value: "90", label: "90 hari" },
  { value: "180", label: "6 bulan" },
  { value: "365", label: "1 tahun" },
  { value: "730", label: "2 tahun" },
  { value: "1095", label: "3 tahun" },
];

// Batas pengaman: 1 putaran ≈ 45 detik kerja, jadi 80 putaran ≈ 1 jam.
// Cukup untuk riwayat bertahun-tahun tanpa jadi loop tak berujung.
const MAX_ROUNDS = 80;

type RunBody = { scope: "all" } | { scope: "store"; storeId: string; days: number };
type RunResult = { created: number; updated: number; partial?: boolean; error?: string };

const toast = (msg: string) => window.dispatchEvent(new CustomEvent("app:toast", { detail: msg }));

// Jalankan sync lewat fetch, bukan Server Action.
//
// Server Action dieksekusi React di dalam transition → router Next menahan
// SEMUA navigasi sampai aksi selesai, jadi aplikasi terasa beku selama sync
// (bisa 45 detik). Dengan fetch, user bebas pindah halaman; progres tetap
// terlihat lewat SyncProgressPanel yang polling tabel SyncJob.
//
// Toko besar tidak muat dalam satu request (Vercel maks 60 detik) → server
// balikin partial=true, dan hook ini memanggil putaran berikutnya sendiri
// sampai selesai. Tiap batch sudah tersimpan, jadi berhenti kapan pun aman.
function useSyncRunner() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const stop = useRef(false);

  const run = useCallback(
    async (body: RunBody) => {
      setRunning(true);
      stop.current = false;
      let acc = { created: 0, updated: 0 };

      try {
        for (let r = 1; r <= MAX_ROUNDS; r++) {
          setRound(r);
          const res = await fetch("/api/sync/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, round: r, accCreated: acc.created, accUpdated: acc.updated }),
          });
          const d = (await res.json().catch(() => ({}))) as RunResult;

          if (!res.ok || d.error) {
            toast(`Sync gagal: ${d.error ?? res.status}`);
            break;
          }
          acc = { created: d.created ?? 0, updated: d.updated ?? 0 };
          router.refresh(); // segarkan "Sync: …" & angka pembukuan

          if (!d.partial) {
            toast(`Sync selesai: ${acc.created} order baru, ${acc.updated} diperbarui`);
            break;
          }
          if (stop.current) {
            toast(`Dijeda: ${acc.created} baru, ${acc.updated} diperbarui — sisanya bisa dilanjut nanti`);
            break;
          }
          if (r === MAX_ROUNDS) toast(`Berhenti setelah ${MAX_ROUNDS} putaran — klik Sync lagi kalau masih ada sisa`);
          // jeda kecil biar tidak membanjiri API marketplace
          await new Promise((ok) => setTimeout(ok, 800));
        }
      } catch (e) {
        toast(`Sync gagal: ${e instanceof Error ? e.message : "unknown"}`);
      } finally {
        setRunning(false);
        setRound(0);
        stop.current = false;
      }
    },
    [router]
  );

  return { run, running, round, pause: () => (stop.current = true) };
}

// Tombol "Sync semua toko"
export function SyncAllButton() {
  const { run, running, round, pause } = useSyncRunner();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={running}
        onClick={() => run({ scope: "all" })}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
      >
        {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {running ? `Menyinkron…${round > 1 ? ` (putaran ${round})` : ""}` : "Sync semua toko"}
      </button>
      {running && (
        <button
          type="button"
          onClick={pause}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Pause size={13} /> Jeda
        </button>
      )}
    </div>
  );
}

// Tombol sync satu toko (+ pilihan rentang untuk Shopee)
export function StoreSyncButton({ storeId, isShopee }: { storeId: string; isShopee: boolean }) {
  const { run, running, round, pause } = useSyncRunner();
  const [days, setDays] = useState("90");

  return (
    <div className="flex items-center gap-1.5">
      {isShopee && (
        <Select
          value={days}
          onValueChange={setDays}
          disabled={running}
          className="w-28"
          options={RANGE_OPTIONS}
        />
      )}
      <button
        type="button"
        disabled={running}
        onClick={() => run({ scope: "store", storeId, days: Number(days) })}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
      >
        {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {running ? `Sync…${round > 1 ? ` (${round})` : ""}` : "Sync sekarang"}
      </button>
      {running && (
        <button
          type="button"
          onClick={pause}
          title="Berhenti setelah putaran ini selesai"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Pause size={12} />
        </button>
      )}
    </div>
  );
}
