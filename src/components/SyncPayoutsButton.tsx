"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { useT } from "@/components/LangProvider";

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
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const run = async () => {
    setBusy(true);
    try {
      const r = await action(90);
      if (r.stores === 0) toast(t("Belum ada toko Shopee yang terhubung", "No connected Shopee store yet"));
      else if (r.errors.length) toast(t("Sebagian gagal: ", "Partially failed: ") + r.errors[0]);
      else
        toast(
          `${r.payouts} ${t("pencairan", "payouts")} · ${r.orders} ${t("order ditandai cair", "orders marked as paid out")}` +
            (r.unmatched
              ? ` · ${r.unmatched} ${t(
                  "order belum ada di database (tarik order lebih lama dulu di halaman Toko)",
                  "orders not in the database yet (pull older orders first on the Stores page)"
                )}`
              : "")
        );
      startTransition(() => router.refresh());
    } catch (e) {
      toast(t("Gagal: ", "Failed: ") + (e instanceof Error ? e.message : t("tidak diketahui", "unknown")));
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
      {busy ? t("Memperbarui…", "Refreshing…") : t("Perbarui dari Shopee", "Refresh from Shopee")}
    </button>
  );
}
