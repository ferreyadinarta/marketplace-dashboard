"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, RefreshCw, Pause, Play } from "lucide-react";

type Action = (formData: FormData) => void | Promise<void>;

// Batas pengaman: 1 putaran ≈ 45 detik kerja, jadi 80 putaran ≈ 1 jam.
// Cukup untuk riwayat bertahun-tahun tanpa jadi loop tak berujung.
const MAX_ROUNDS = 80;

// Banner "sync berjalan sebagian" yang MELANJUTKAN SENDIRI.
// Toko besar tidak muat dalam 1 request (Vercel maks 60 detik), jadi tiap putaran
// menyimpan progresnya lalu halaman ini otomatis mengirim ulang sampai selesai —
// user tidak perlu klik "Sync sekarang" berulang kali.
export function AutoSyncBanner({ action }: { action: Action }) {
  const sp = useSearchParams();
  const partial = sp.get("sync") === "partial";
  const storeId = sp.get("storeId") ?? "";
  const days = sp.get("days") ?? "90";
  const round = Math.max(1, Number(sp.get("round") ?? 1) || 1);
  const created = sp.get("created") ?? "0";
  const updated = sp.get("updated") ?? "0";

  const [auto, setAuto] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  const resumable = partial && !!storeId && round <= MAX_ROUNDS;
  const running = resumable && auto;

  useEffect(() => {
    if (!running) return;
    // jeda kecil supaya UI sempat tampil & tidak membanjiri Shopee
    const t = setTimeout(() => formRef.current?.requestSubmit(), 1200);
    return () => clearTimeout(t);
  }, [running, round]);

  if (!partial) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
      {running ? (
        <RefreshCw size={18} className="mt-0.5 shrink-0 animate-spin text-amber-500" />
      ) : (
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0 flex-1">
        <p>
          Menarik data toko ini (banyak, jadi bertahap): <strong>{created} order baru</strong>, {updated}{" "}
          diperbarui — semua sudah tersimpan.
        </p>
        <p className="mt-0.5 text-xs text-amber-700">
          {running ? (
            <>
              Melanjutkan otomatis… (putaran {round}). Biarkan halaman ini terbuka; berhenti sendiri kalau sudah
              selesai.
            </>
          ) : resumable ? (
            <>Dijeda. Klik Lanjutkan untuk menarik sisanya.</>
          ) : !storeId ? (
            <>Klik “Sync sekarang” lagi pada toko yang bersangkutan untuk melanjutkan.</>
          ) : (
            <>Sudah {MAX_ROUNDS} putaran — dihentikan otomatis. Klik Lanjutkan kalau masih ada sisa.</>
          )}
        </p>

        {/* form tersembunyi: dikirim ulang otomatis tiap putaran */}
        <form ref={formRef} action={action} className="hidden">
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="days" value={days} />
          <input type="hidden" name="round" value={String(round)} />
          <input type="hidden" name="accCreated" value={created} />
          <input type="hidden" name="accUpdated" value={updated} />
        </form>
      </div>

      {!!storeId && (
        <button
          type="button"
          onClick={() => {
            if (auto) setAuto(false);
            else {
              setAuto(true);
              formRef.current?.requestSubmit();
            }
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          {auto ? (
            <>
              <Pause size={13} /> Jeda
            </>
          ) : (
            <>
              <Play size={13} /> Lanjutkan
            </>
          )}
        </button>
      )}
    </div>
  );
}
