"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { Select } from "@/components/Select";

type Result = {
  payouts: number;
  orders: number;
  amount: number;
  unmatched: number; // order sudah cair tapi belum ada di database
  errors: string[];
  stores: number;
  state: Record<string, string>;
  done: boolean;
};

const MAX_ROUNDS = 40; // ±30 menit kerja, pengaman

const toast = (msg: string) => window.dispatchEvent(new CustomEvent("app:toast", { detail: msg }));

// Tarik data pencairan Shopee & Blibli → isi tabel rekonsiliasi.
// Rentang panjang dikerjakan per putaran (±40 detik), lanjut otomatis sampai semua toko selesai.
export function SyncPayoutsButton({
  action,
}: {
  action: (days?: number, state?: Record<string, string>) => Promise<Result>;
}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const [days, setDays] = useState("90");
  const [, startTransition] = useTransition();

  const run = async () => {
    setBusy(true);
    try {
      let state: Record<string, string> = {};
      const r = { payouts: 0, orders: 0, amount: 0, unmatched: 0, errors: [] as string[], stores: 0 };
      for (let i = 1; i <= MAX_ROUNDS; i++) {
        setRound(i);
        const x = await action(Number(days), state);
        state = x.state;
        r.payouts += x.payouts;
        r.orders += x.orders;
        r.amount += x.amount;
        r.unmatched += x.unmatched;
        r.errors.push(...x.errors);
        r.stores = x.stores;
        if (x.done) break;
      }
      if (r.stores === 0) toast(t("Belum ada toko Shopee/Blibli yang terhubung", "No connected Shopee/Blibli store yet"));
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
      setRound(0);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={days}
        onValueChange={setDays}
        disabled={busy}
        className="w-32"
        options={[
          { value: "90", label: t("90 hari", "90 days") },
          { value: "180", label: t("6 bulan", "6 months") },
          { value: "365", label: t("1 tahun", "1 year") },
          { value: "3650", label: t("Semua data", "All data") },
        ]}
      />
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {busy
          ? t("Memperbarui…", "Refreshing…") + (round > 1 ? ` (${round})` : "")
          : t("Perbarui dana cair", "Refresh payouts")}
      </button>
    </div>
  );
}
