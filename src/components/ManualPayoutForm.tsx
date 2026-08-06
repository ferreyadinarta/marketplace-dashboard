"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { SubmitButton } from "@/components/SubmitButton";
import { DatePicker } from "@/components/DatePicker";

type Action = (formData: FormData) => void | Promise<void>;

// Catat uang yang BENAR-BENAR diterima untuk toko tanpa API (grosir/reseller,
// WA, marketplace manual). Dipakai di Rekonsiliasi: net seharusnya − yang sudah
// diterima = piutang yang masih ditunggu.
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <Plus size={13} /> Catat pembayaran
      </button>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => {
        setOpen(false);
        setAmount(0);
      }}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"
    >
      <input type="hidden" name="storeId" value={storeId} />

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-slate-500">Tanggal terima</span>
        <div className="w-40">
          <DatePicker name="tanggal" defaultValue={today} />
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-slate-500">Jumlah diterima</span>
        <div className="w-40">
          <CurrencyInput name="amount" value={amount} onValueChange={setAmount} placeholder="0" />
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-slate-500">Referensi (opsional)</span>
        <input
          name="reference"
          placeholder="ex: transfer BCA 12/8"
          className="h-10 w-48 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <SubmitButton
        variant="primary"
        pendingText="Menyimpan…"
        notify={`Pembayaran ${storeName} tercatat`}
        disabled={amount <= 0}
        className="h-10"
      >
        Simpan
      </SubmitButton>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Batal"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-600"
      >
        <X size={16} />
      </button>
    </form>
  );
}
