"use client";

import { useState, useMemo } from "react";
import { Tags, ChevronDown, Search } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { SubmitButton } from "@/components/SubmitButton";

type Action = (formData: FormData) => void | Promise<void>;

export type PriceRow = {
  id: string;
  name: string;
  sku: string;
  hpp: number;
  priceRetail: number;
  priceGrosir: number;
};

type Vals = { hpp: number; retail: number; grosir: number };

// Isi HPP / harga retail / harga grosir banyak product sekaligus, simpan sekali.
// Berguna setelah import: banyak product perlu diisi harganya tanpa buka satu-satu.
export function BulkPriceForm({ products, action }: { products: PriceRow[]; action: Action }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [rows, setRows] = useState<Record<string, Vals>>(() =>
    Object.fromEntries(
      products.map((p) => [p.id, { hpp: p.hpp, retail: p.priceRetail, grosir: p.priceGrosir }])
    )
  );

  const set = (id: string, key: keyof Vals, val: number) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  const emptyCount = products.filter((p) => (rows[p.id]?.hpp ?? 0) <= 0).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyEmpty && (rows[p.id]?.hpp ?? 0) > 0) return false;
      if (needle && !`${p.name} ${p.sku}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [products, rows, q, onlyEmpty]);

  const payload = products.map((p) => ({ id: p.id, ...rows[p.id] }));

  if (products.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Tags size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Isi Harga Massal</span>
          <span className="block text-xs text-slate-500">
            Isi HPP & harga jual banyak product sekaligus, simpan sekali.
            {emptyCount > 0 && (
              <span className="ml-1 font-medium text-amber-600">{emptyCount} belum ada HPP.</span>
            )}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form action={action} className="border-t border-slate-100 p-5">
          <input type="hidden" name="prices" value={JSON.stringify(payload)} />

          {/* filter */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama atau SKU…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyEmpty}
                onChange={(e) => setOnlyEmpty(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Hanya yang belum ada HPP
            </label>
          </div>

          {/* header kolom */}
          <div className="hidden gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_repeat(3,7rem)]">
            <span>Product</span>
            <span>HPP (modal)</span>
            <span>Retail</span>
            <span>Grosir</span>
          </div>

          {/* daftar */}
          <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {filtered.map((p) => {
              const v = rows[p.id];
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 p-2 sm:grid-cols-[1fr_repeat(3,7rem)] sm:items-center sm:border-0 sm:p-1"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <CurrencyInput value={v.hpp} onValueChange={(n) => set(p.id, "hpp", n)} placeholder="HPP" className="h-9" />
                  <CurrencyInput value={v.retail} onValueChange={(n) => set(p.id, "retail", n)} placeholder="Retail" className="h-9" />
                  <CurrencyInput value={v.grosir} onValueChange={(n) => set(p.id, "grosir", n)} placeholder="Grosir" className="h-9" />
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">Tidak ada product yang cocok.</p>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <SubmitButton
              variant="primary"
              pendingText="Menyimpan…"
              notify="Harga tersimpan"
              className="w-full justify-center sm:w-auto"
            >
              Simpan Semua Harga
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
