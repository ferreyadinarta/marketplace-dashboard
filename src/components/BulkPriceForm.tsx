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
  unit: string;
  packUnit: string;
  packSize: number;
  koliUnit: string;
  koliSize: number;
};

type Vals = { hpp: number; retail: number; grosir: number };
type UnitVals = { mainUnit: string; smallUnit: string; isi: string; koliUnit: string; isiKoli: string };
type Tab = "harga" | "satuan";

// tampilan "box-first": satuan utama = pack kalau ada, kecil = base
function initUnit(p: PriceRow): UnitVals {
  const hasPack = p.packSize > 0;
  return {
    mainUnit: hasPack ? p.packUnit : p.unit,
    smallUnit: hasPack ? p.unit : "",
    isi: hasPack ? String(p.packSize) : "",
    // default "koli" — diabaikan kalau isi koli kosong, jadi aman
    koliUnit: p.koliUnit || "koli",
    isiKoli: p.koliSize > 0 ? String(p.koliSize) : "",
  };
}

// Isi HPP/harga + satuan (box/sachet/isi/koli) banyak product sekaligus, simpan sekali.
// Dirancang untuk SETELAH import: import cuma bawa nama+SKU+harga, satuan & HPP kosong.
export function BulkPriceForm({ products, action }: { products: PriceRow[]; action: Action }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("harga");
  const [q, setQ] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [rows, setRows] = useState<Record<string, Vals>>(() =>
    Object.fromEntries(products.map((p) => [p.id, { hpp: p.hpp, retail: p.priceRetail, grosir: p.priceGrosir }]))
  );
  const [units, setUnits] = useState<Record<string, UnitVals>>(() =>
    Object.fromEntries(products.map((p) => [p.id, initUnit(p)]))
  );
  // template "isi sekali → terapkan ke semua" untuk satuan yang seragam
  const [tpl, setTpl] = useState<UnitVals>({ mainUnit: "", smallUnit: "", isi: "", koliUnit: "koli", isiKoli: "" });

  const set = (id: string, key: keyof Vals, val: number) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [key]: val } }));
  const setU = (id: string, key: keyof UnitVals, val: string) =>
    setUnits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: val } }));
  const setTplField = (key: keyof UnitVals, val: string) => setTpl((p) => ({ ...p, [key]: val }));

  const emptyCount = products.filter((p) => (rows[p.id]?.hpp ?? 0) <= 0).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyEmpty && (rows[p.id]?.hpp ?? 0) > 0) return false;
      if (needle && !`${p.name} ${p.sku}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [products, rows, q, onlyEmpty]);

  // terapkan template satuan ke semua product yang sedang TAMPIL (bisa difilter dulu)
  const tplHasValue = !!(tpl.mainUnit || tpl.smallUnit || tpl.isi || tpl.koliUnit || tpl.isiKoli);
  const applyTpl = () =>
    setUnits((prev) => {
      const next = { ...prev };
      for (const p of filtered) next[p.id] = { ...tpl };
      return next;
    });

  // kirim harga + satuan sekaligus (state = nilai sekarang, jadi baris tak disentuh tetap sama)
  const payload = products.map((p) => ({ id: p.id, ...rows[p.id], ...units[p.id] }));

  if (products.length === 0) return null;

  const inputCls =
    "h-9 w-full rounded-lg border border-slate-300 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";
  const tabCls = (t: Tab) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;

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
          <span className="block text-sm font-semibold text-slate-900">Isi Harga & Satuan Massal</span>
          <span className="block text-xs text-slate-500">
            Lengkapi HPP, harga jual, dan satuan (box/sachet/koli) banyak product sekaligus — cocok setelah import.
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

          {/* tab: harga / satuan */}
          <div className="mb-3 inline-flex gap-1 rounded-xl bg-slate-50 p-1">
            <button type="button" onClick={() => setTab("harga")} className={tabCls("harga")}>
              Harga
            </button>
            <button type="button" onClick={() => setTab("satuan")} className={tabCls("satuan")}>
              Satuan
            </button>
          </div>

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
            {tab === "harga" && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={onlyEmpty}
                  onChange={(e) => setOnlyEmpty(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Hanya yang belum ada HPP
              </label>
            )}
          </div>

          {tab === "satuan" && (
            <>
              <p className="mb-2 text-xs text-slate-400">
                Satuan utama = yang dipakai sehari-hari (mis. box). Kecil = eceran (mis. sachet). Isi = 1 utama berapa
                kecil. Koli = satuan terbesar saat barang masuk (isi = 1 koli berapa box). Kosongkan yang tidak dipakai.
              </p>
              {/* isi sekali → terapkan ke semua yang tampil */}
              <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <p className="mb-2 text-xs font-medium text-indigo-900">
                  Isi sekali, terapkan ke semua yang tampil
                  <span className="ml-1 font-normal text-indigo-500">(pakai kotak Cari dulu kalau mau sebagian)</span>
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(2,6rem)_4rem_6rem_4rem_auto]">
                  <input value={tpl.mainUnit} onChange={(e) => setTplField("mainUnit", e.target.value)} placeholder="box" className={inputCls} />
                  <input value={tpl.smallUnit} onChange={(e) => setTplField("smallUnit", e.target.value)} placeholder="sachet" className={inputCls} />
                  <input value={tpl.isi} onChange={(e) => setTplField("isi", e.target.value)} type="number" min="0" placeholder="12" className={inputCls} />
                  <input value={tpl.koliUnit} onChange={(e) => setTplField("koliUnit", e.target.value)} placeholder="koli" className={inputCls} />
                  <input value={tpl.isiKoli} onChange={(e) => setTplField("isiKoli", e.target.value)} type="number" min="0" placeholder="6" className={inputCls} />
                  <button
                    type="button"
                    onClick={applyTpl}
                    disabled={!tplHasValue || filtered.length === 0}
                    className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 sm:col-span-1"
                  >
                    Terapkan ke {filtered.length}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* header kolom (desktop) */}
          {tab === "harga" ? (
            <div className="hidden gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_repeat(3,7rem)]">
              <span>Product</span>
              <span>HPP (modal)</span>
              <span>Retail</span>
              <span>Grosir</span>
            </div>
          ) : (
            <div className="hidden gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_repeat(2,6rem)_4rem_6rem_4rem]">
              <span>Product</span>
              <span>Satuan utama</span>
              <span>Kecil</span>
              <span>Isi</span>
              <span>Koli</span>
              <span>Isi/koli</span>
            </div>
          )}

          {/* daftar */}
          <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {filtered.map((p) => {
              const v = rows[p.id];
              const u = units[p.id];
              return tab === "harga" ? (
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
              ) : (
                <div
                  key={p.id}
                  className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 p-2 sm:grid-cols-[1fr_repeat(2,6rem)_4rem_6rem_4rem] sm:items-center sm:border-0 sm:p-1"
                >
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <input value={u.mainUnit} onChange={(e) => setU(p.id, "mainUnit", e.target.value)} placeholder="box" className={inputCls} />
                  <input value={u.smallUnit} onChange={(e) => setU(p.id, "smallUnit", e.target.value)} placeholder="sachet" className={inputCls} />
                  <input value={u.isi} onChange={(e) => setU(p.id, "isi", e.target.value)} type="number" min="0" placeholder="12" className={inputCls} />
                  <input value={u.koliUnit} onChange={(e) => setU(p.id, "koliUnit", e.target.value)} placeholder="koli" className={inputCls} />
                  <input value={u.isiKoli} onChange={(e) => setU(p.id, "isiKoli", e.target.value)} type="number" min="0" placeholder="6" className={inputCls} />
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
              notify="Tersimpan"
              className="w-full justify-center sm:w-auto"
            >
              Simpan Semua
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
