"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { SubmitButton } from "@/components/SubmitButton";
import { DatePicker } from "@/components/DatePicker";

type Action = (formData: FormData) => void | Promise<void>;

// Catat uang yang BENAR-BENAR diterima untuk toko tanpa API (grosir/reseller,
// WA, marketplace manual). Dipakai di Rekonsiliasi: net seharusnya − yang sudah
// diterima = piutang yang masih ditunggu.
//
// Formnya dibuka sebagai DIALOG (portal ke body), bukan inline di dalam sel
// tabel: form 3 kolom di dalam sel bikin kolom lain (badge status) ikut
// terhimpit dan barisnya melar.
export function ManualPayoutForm({
  storeId,
  storeName,
  today,
  action,
}: {
  storeId: string;
  storeName: string;
  today: string;
  action: Action;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
    >
      <Plus size={13} /> Catat pembayaran
    </button>
  );

  // portal baru boleh dipakai setelah ada document (klien); saat tertutup pun
  // tidak ada yang perlu di-render selain tombolnya
  if (!open || typeof document === "undefined") return trigger;

  return (
    <>
      {trigger}
      {createPortal(
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
          <div
            onClick={() => setOpen(false)}
            aria-hidden
            className="animate-fade absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="animate-sheet relative w-full overflow-hidden rounded-t-2xl bg-white shadow-[0_-8px_40px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-200 sm:max-w-md sm:rounded-2xl"
          >
            <div className="h-1 w-full bg-indigo-500" />
            <form
              action={action}
              onSubmit={() => {
                setOpen(false);
                setAmount(0);
              }}
            >
              <input type="hidden" name="storeId" value={storeId} />

              <div className="space-y-3 px-5 pb-5 pt-4 sm:px-6 sm:pt-5">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">Catat pembayaran diterima</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Uang yang benar-benar masuk dari <strong className="text-slate-700">{storeName}</strong>.
                    Sisanya dianggap belum dibayar.
                  </p>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">Tanggal terima</span>
                  <DatePicker name="tanggal" defaultValue={today} />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">Jumlah diterima</span>
                  <CurrencyInput name="amount" value={amount} onValueChange={setAmount} placeholder="0" />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">Referensi (opsional)</span>
                  <input
                    name="reference"
                    placeholder="ex: transfer BCA 12/8"
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <div className="flex gap-2.5 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:flex-none"
                >
                  Batal
                </button>
                <SubmitButton
                  variant="primary"
                  pendingText="Menyimpan…"
                  notify={`Pembayaran ${storeName} tercatat`}
                  disabled={amount <= 0}
                  className="flex-1 sm:flex-none"
                >
                  Simpan
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
