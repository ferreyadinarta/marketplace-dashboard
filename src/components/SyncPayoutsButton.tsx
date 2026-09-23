"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

type Result = {
  payouts: number;
  orders: number;
  amount: number;
  unmatched: number; // order sudah cair tapi belum ada di database
  errors: string[];
  stores: number;
};

const toast = (msg: string) => window.dispatchEvent(new CustomEvent("app:toast", { detail: msg }));

// Tarik data pencairan Shopee (escrow yang sudah rilis) → isi tabel rekonsiliasi.
export function SyncPayoutsButton({ action }: { action: (days?: number) => Promise<Result> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const run = async () => {
    setBusy(true);
    try {
      const r = await action(90);
      if (r.stores === 0) toast("Belum ada toko Shopee yang terhubung");
      else if (r.errors.length) toast(`Sebagian gagal: ${r.errors[0]}`);
      else
        toast(
          `${r.payouts} pencairan · ${r.orders} order ditandai cair` +
            (r.unmatched
              ? ` · ${r.unmatched} order belum ada di database (tarik order lebih lama dulu di halaman Toko)`
              : "")
        );
      startTransition(() => router.refresh());
    } catch (e) {
      toast(`Gagal: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      {busy ? "Memperbarui…" : "Perbarui dari Shopee"}
    </button>
  );
}
