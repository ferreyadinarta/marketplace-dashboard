"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useFormStatus } from "react-dom";
import { Tags, ChevronDown, Search, Loader2, Wand2 } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Collapse } from "@/components/Collapse";
import { useT } from "@/components/LangProvider";

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

const sameVals = (a: Vals, b: Vals) => a.hpp === b.hpp && a.retail === b.retail && a.grosir === b.grosir;
const sameUnits = (a: UnitVals, b: UnitVals) =>
  a.mainUnit === b.mainUnit &&
  a.smallUnit === b.smallUnit &&
  a.isi === b.isi &&
  a.koliUnit === b.koliUnit &&
  a.isiKoli === b.isiKoli;

// Bar simpan yang cuma muncul kalau ADA perubahan belum disimpan.
// Dipisah jadi komponen sendiri karena useFormStatus harus di dalam <form>.
function SaveBar({ dirtyCount, onDone }: { dirtyCount: number; onDone: () => void }) {
  const t = useT();
  const { pending } = useFormStatus();
  const prev = useRef(false);
  const cb = useRef(onDone);

  useEffect(() => {
    cb.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!pending && prev.current) {
      cb.current();
      window.dispatchEvent(new CustomEvent("app:toast", { detail: t("Tersimpan", "Saved") }));
    }
    prev.current = pending;
  }, [pending, t]);

  if (!pending && dirtyCount === 0) return null;

  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-3 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
      <p className="text-sm text-slate-600">
        {pending ? (
          <span className="inline-flex items-center gap-2 text-slate-500">
            <Loader2 size={14} className="animate-spin" /> {t("Menyimpan…", "Saving…")}
          </span>
        ) : (
          <>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />
            <strong className="font-medium text-slate-800">{dirtyCount} product</strong> {t("belum disimpan", "not saved yet")}
          </>
        )}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {t("Simpan", "Save")}
      </button>
    </div>
  );
}

// Isi HPP/harga + satuan (box/sachet/isi/koli) banyak product sekaligus.
// Dirancang untuk SETELAH import: import cuma bawa nama+SKU+harga, satuan & HPP kosong.
//
// Alur simpan: tidak ada tombol "Simpan Semua" permanen —
//  • edit manual per baris → bar "belum disimpan" muncul sendiri di bawah;
//  • "Terapkan ke semua" → konfirmasi dulu, lalu langsung tersimpan.
// Yang dikirim ke server HANYA baris yang berubah.
export function BulkPriceForm({
  products,
  action,
  defaultOpen = false,
}: {
  products: PriceRow[];
  action: Action;
  defaultOpen?: boolean; // dibuka dari link "Isi HPP" → langsung tampilkan yang HPP-nya kosong
}) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<Tab>("harga");
  const [q, setQ] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(defaultOpen);
  const [confirmTpl, setConfirmTpl] = useState(false);

  // State cuma menyimpan PERUBAHAN user (override per product), bukan salinan
  // penuh daftar product. Penting: daftar product bisa berubah kapan saja
  // (tambah/hapus product lalu halaman di-revalidate) — kalau state menyalin
  // daftar saat mount, product baru tidak punya entri dan barisnya crash.
  const [rows, setRows] = useState<Record<string, Vals>>({});
  const [units, setUnits] = useState<Record<string, UnitVals>>({});

  // nilai tersimpan = yang datang dari server; jadi acuan "belum disimpan"
  const savedVals = (p: PriceRow): Vals => ({ hpp: p.hpp, retail: p.priceRetail, grosir: p.priceGrosir });
  const valsOf = (p: PriceRow): Vals => rows[p.id] ?? savedVals(p);
  const unitsOf = (p: PriceRow): UnitVals => units[p.id] ?? initUnit(p);

  // template "isi sekali → terapkan ke semua" untuk satuan yang seragam
  const [tpl, setTpl] = useState<UnitVals>({ mainUnit: "", smallUnit: "", isi: "", koliUnit: "koli", isiKoli: "" });

  const formRef = useRef<HTMLFormElement>(null);
  // ditandai saat template diterapkan → form dikirim setelah state satuan kepasang
  const wantSubmit = useRef(false);

  const set = (id: string, key: keyof Vals, val: number) =>
    setRows((prev) => {
      const p = products.find((x) => x.id === id);
      const cur = prev[id] ?? (p ? savedVals(p) : { hpp: 0, retail: 0, grosir: 0 });
      return { ...prev, [id]: { ...cur, [key]: val } };
    });
  const setU = (id: string, key: keyof UnitVals, val: string) =>
    setUnits((prev) => {
      const p = products.find((x) => x.id === id);
      const cur = prev[id] ?? (p ? initUnit(p) : { mainUnit: "", smallUnit: "", isi: "", koliUnit: "koli", isiKoli: "" });
      return { ...prev, [id]: { ...cur, [key]: val } };
    });
  const setTplField = (key: keyof UnitVals, val: string) => setTpl((p) => ({ ...p, [key]: val }));

  const emptyCount = products.filter((p) => valsOf(p).hpp <= 0).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyEmpty && (rows[p.id]?.hpp ?? p.hpp) > 0) return false;
      if (needle && !`${p.name} ${p.sku}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [products, rows, q, onlyEmpty]);

  // baris yang berubah dari nilai tersimpan → cuma ini yang dikirim.
  // Setelah simpan sukses, server mengirim data baru → otomatis tidak dirty lagi.
  const dirtyIds = useMemo(
    () =>
      products
        .filter((p) => !sameVals(valsOf(p), savedVals(p)) || !sameUnits(unitsOf(p), initUnit(p)))
        .map((p) => p.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, rows, units]
  );
  const payload = dirtyIds.map((id) => {
    const p = products.find((x) => x.id === id)!;
    return { id, ...valsOf(p), ...unitsOf(p) };
  });

  // terapkan template satuan ke semua product yang sedang TAMPIL, lalu simpan
  const tplHasValue = !!(tpl.mainUnit || tpl.smallUnit || tpl.isi || tpl.isiKoli);
  const applyTplAndSave = useCallback(() => {
    setUnits((prev) => {
      const next = { ...prev };
      for (const p of filtered) next[p.id] = { ...tpl };
      return next;
    });
    setConfirmTpl(false);
    wantSubmit.current = true; // submit setelah state kepasang (lihat effect di bawah)
  }, [filtered, tpl]);

  // begitu satuan hasil template sudah masuk state (dan hidden input ikut
  // terbarui), langsung kirim — user tidak perlu klik Simpan lagi.
  useEffect(() => {
    if (!wantSubmit.current) return;
    wantSubmit.current = false;
    formRef.current?.requestSubmit();
  }, [units]);

  if (products.length === 0) return null;

  // dasar tanpa lebar — lebarnya ditentukan di tempat pakai (jangan gabung
  // w-full dengan w-24, Tailwind akan bentrok dan yang menang tak tentu)
  const fieldCls =
    "h-9 rounded-lg border border-slate-300 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";
  const inputCls = `${fieldCls} w-full`;
  const tabCls = (tb: Tab) =>
    `rounded-lg px-4 py-1.5 text-sm font-medium transition ${
      tab === tb ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
    }`;

  // ringkasan template dalam bahasa manusia — dipakai di modal konfirmasi
  const tplLines: string[] = [];
  if (tpl.smallUnit && Number(tpl.isi) >= 2)
    tplLines.push(`1 ${tpl.mainUnit || "pcs"} = ${tpl.isi} ${tpl.smallUnit}`);
  if (tpl.koliUnit && Number(tpl.isiKoli) >= 2 && tpl.smallUnit && Number(tpl.isi) >= 2)
    tplLines.push(`1 ${tpl.koliUnit} = ${tpl.isiKoli} ${tpl.mainUnit || "pcs"}`);
  if (tplLines.length === 0)
    tplLines.push(t(`Satuan: ${tpl.mainUnit || "pcs"} (tanpa satuan kecil)`, `Unit: ${tpl.mainUnit || "pcs"} (no small unit)`));

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
          <span className="block text-sm font-semibold text-slate-900">{t("Isi Harga & Satuan Massal", "Bulk price & unit entry")}</span>
          <span className="block text-xs text-slate-500">
            {t(
              "Lengkapi HPP (per satuan utama), harga jual, dan satuan (box/sachet/koli) banyak product sekaligus.",
              "Fill in COGS (per main unit), selling price, and units (box/sachet/carton) for many products at once."
            )}
            {emptyCount > 0 && (
              <span className="ml-1 font-medium text-amber-600">{t(`${emptyCount} belum ada HPP.`, `${emptyCount} missing COGS.`)}</span>
            )}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <Collapse open={open}>
        <form ref={formRef} action={action} className="border-t border-slate-100 p-5">
          <input type="hidden" name="prices" value={JSON.stringify(payload)} />

          {/* tab: harga / satuan */}
          <div className="mb-3 inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button type="button" onClick={() => setTab("harga")} className={tabCls("harga")}>
              {t("Harga", "Price")}
            </button>
            <button type="button" onClick={() => setTab("satuan")} className={tabCls("satuan")}>
              {t("Satuan", "Unit")}
            </button>
          </div>

          {/* filter */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Cari nama atau SKU…", "Search name or SKU…")}
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
                {t("Hanya yang belum ada HPP", "Only missing COGS")}
              </label>
            )}
          </div>

          {tab === "satuan" && (
            <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
              {/* dibaca seperti kalimat: 1 box berisi 12 sachet · 1 koli berisi 24 box */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-600">
                <span className="text-xs font-medium text-indigo-900">{t("Isi sekali:", "Fill once:")}</span>
                <span>1</span>
                <input
                  value={tpl.mainUnit}
                  onChange={(e) => setTplField("mainUnit", e.target.value)}
                  placeholder="box"
                  aria-label={t("Satuan utama", "Main unit")}
                  className={`${fieldCls} w-24`}
                />
                <span>{t("berisi", "contains")}</span>
                <input
                  value={tpl.isi}
                  onChange={(e) => setTplField("isi", e.target.value)}
                  type="number"
                  min="0"
                  placeholder="12"
                  aria-label={t("Isi per satuan utama", "Contents per main unit")}
                  className={`${fieldCls} w-16`}
                />
                <input
                  value={tpl.smallUnit}
                  onChange={(e) => setTplField("smallUnit", e.target.value)}
                  placeholder="sachet"
                  aria-label={t("Satuan kecil", "Small unit")}
                  className={`${fieldCls} w-24`}
                />
                <span className="text-slate-300">·</span>
                <span>1</span>
                <input
                  value={tpl.koliUnit}
                  onChange={(e) => setTplField("koliUnit", e.target.value)}
                  placeholder="koli"
                  aria-label={t("Satuan koli", "Carton unit")}
                  className={`${fieldCls} w-20`}
                />
                <span>{t("berisi", "contains")}</span>
                <input
                  value={tpl.isiKoli}
                  onChange={(e) => setTplField("isiKoli", e.target.value)}
                  type="number"
                  min="0"
                  placeholder="24"
                  aria-label={t("Isi per koli", "Contents per carton")}
                  className={`${fieldCls} w-16`}
                />
                <span>{tpl.mainUnit || "box"}</span>

                <button
                  type="button"
                  onClick={() => setConfirmTpl(true)}
                  disabled={!tplHasValue || filtered.length === 0}
                  className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Wand2 size={15} />
                  {t(`Terapkan ke ${filtered.length}`, `Apply to ${filtered.length}`)}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {t(
                  `Berlaku untuk ${filtered.length} product yang tampil (saring dulu pakai kotak Cari kalau mau sebagian). Satuan kecil & koli boleh dikosongkan.`,
                  `Applies to the ${filtered.length} products shown (filter with the search box first for just some of them). Small unit & carton unit can be left blank.`
                )}
              </p>
            </div>
          )}

          {/* header kolom (desktop) */}
          {tab === "harga" ? (
            <div className="hidden gap-2 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_repeat(3,7rem)]">
              <span>Product</span>
              <span>{t("HPP (modal) / satuan utama", "COGS / main unit")}</span>
              <span>{t("Retail", "Retail")}</span>
              <span>{t("Grosir", "Wholesale")}</span>
            </div>
          ) : (
            <div className="hidden gap-2 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_repeat(2,6rem)_4rem_6rem_4rem]">
              <span>Product</span>
              <span>{t("Satuan utama", "Main unit")}</span>
              <span>{t("Kecil", "Small")}</span>
              <span>{t("Isi", "Contains")}</span>
              <span>{t("Koli", "Carton")}</span>
              <span>{t("Isi/koli", "Carton contents")}</span>
            </div>
          )}

          {/* daftar */}
          <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {filtered.map((p) => {
              const v = valsOf(p);
              const u = unitsOf(p);
              const dirty = dirtyIds.includes(p.id);
              return tab === "harga" ? (
                <div
                  key={p.id}
                  className={`grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_repeat(3,7rem)] sm:items-center sm:px-3 sm:py-2 ${
                    dirty ? "border-amber-200 bg-amber-50/40" : "border-slate-100 sm:border-transparent"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <CurrencyInput
                    value={v.hpp}
                    onValueChange={(n) => set(p.id, "hpp", n)}
                    placeholder={`per ${p.packSize > 0 ? p.packUnit : p.unit}`}
                    className="h-9"
                  />
                  <CurrencyInput value={v.retail} onValueChange={(n) => set(p.id, "retail", n)} placeholder={t("Retail", "Retail")} className="h-9" />
                  <CurrencyInput value={v.grosir} onValueChange={(n) => set(p.id, "grosir", n)} placeholder={t("Grosir", "Wholesale")} className="h-9" />
                </div>
              ) : (
                <div
                  key={p.id}
                  className={`grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_repeat(2,6rem)_4rem_6rem_4rem] sm:items-center sm:px-3 sm:py-2 ${
                    dirty ? "border-amber-200 bg-amber-50/40" : "border-slate-100 sm:border-transparent"
                  }`}
                >
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <input value={u.mainUnit} onChange={(e) => setU(p.id, "mainUnit", e.target.value)} placeholder="box" aria-label={t("Satuan utama", "Main unit")} className={inputCls} />
                  <input value={u.smallUnit} onChange={(e) => setU(p.id, "smallUnit", e.target.value)} placeholder="sachet" aria-label={t("Satuan kecil", "Small unit")} className={inputCls} />
                  <input value={u.isi} onChange={(e) => setU(p.id, "isi", e.target.value)} type="number" min="0" placeholder="12" aria-label={t("Isi per satuan utama", "Contents per main unit")} className={inputCls} />
                  <input value={u.koliUnit} onChange={(e) => setU(p.id, "koliUnit", e.target.value)} placeholder="koli" aria-label={t("Satuan koli", "Carton unit")} className={inputCls} />
                  <input value={u.isiKoli} onChange={(e) => setU(p.id, "isiKoli", e.target.value)} type="number" min="0" placeholder="24" aria-label={t("Isi per koli", "Contents per carton")} className={inputCls} />
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">{t("Tidak ada product yang cocok.", "No matching products.")}</p>
            )}
          </div>

          {/* Selesai simpan → buang override; nilai tersimpan datang dari server
              (halaman di-revalidate), jadi barisnya otomatis balik "bersih". */}
          <SaveBar
            dirtyCount={dirtyIds.length}
            onDone={() => {
              setRows({});
              setUnits({});
            }}
          />
        </form>
      </Collapse>

      {/* konfirmasi sebelum satuan ditimpa massal — langsung tersimpan setelah OK */}
      <ConfirmDialog
        open={confirmTpl}
        onClose={() => setConfirmTpl(false)}
        onConfirm={applyTplAndSave}
        tone="primary"
        title={t(`Terapkan satuan ke ${filtered.length} product?`, `Apply unit to ${filtered.length} products?`)}
        confirmText={t("Terapkan & Simpan", "Apply & Save")}
        message={
          <>
            <ul className="mb-2 space-y-0.5 font-medium text-slate-700">
              {tplLines.map((l) => (
                <li key={l}>• {l}</li>
              ))}
            </ul>
            <p>
              {t(
                `Satuan lama ${filtered.length} product ini akan`,
                `The current unit of these ${filtered.length} products will be`
              )}{" "}
              <strong>{t("ditimpa", "overwritten")}</strong> {t("dan langsung tersimpan.", "and saved immediately.")}{" "}
              {t("Product yang tidak tampil di daftar tidak berubah.", "Products not shown in the list are unaffected.")}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {filtered
                .slice(0, 4)
                .map((p) => p.name)
                .join(", ")}
              {filtered.length > 4 ? t(` + ${filtered.length - 4} lainnya`, ` + ${filtered.length - 4} more`) : ""}
            </p>
          </>
        }
      />
    </div>
  );
}
