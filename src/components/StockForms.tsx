"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackagePlus, Plus, Search, X, ClipboardCheck, ArrowUpNarrowWide, ChevronDown, ClipboardList } from "lucide-react";
import { Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { DatePicker } from "@/components/DatePicker";
import { CurrencyInput } from "@/components/CurrencyInput";

type Option = { value: string; label: string };
type Action = (formData: FormData) => void | Promise<void>;

// ---------- Barang masuk (restock) — multi-product ----------
type RestockOption = {
  value: string;
  label: string;
  unit?: string;
  packUnit?: string;
  packSize?: number;
  koliUnit?: string;
  koliSize?: number;
  current?: number;
};
type RUnit = "base" | "pack" | "koli";
type RItem = { productId: string; qty: string; cost: string; unit: RUnit };

export function RestockForm({
  products,
  action,
  today,
}: {
  products: RestockOption[];
  action: Action;
  today: string;
}) {
  const [items, setItems] = useState<RItem[]>([{ productId: "", qty: "1", cost: "", unit: "base" }]);
  const [error, setError] = useState<string | undefined>();
  const prodOf = (pid: string) => products.find((p) => p.value === pid);
  const hasPack = (pid: string) => {
    const p = prodOf(pid);
    return !!p && (p.packSize ?? 0) >= 2 && !!p.packUnit;
  };
  const hasKoli = (pid: string) => {
    const p = prodOf(pid);
    return hasPack(pid) && (p?.koliSize ?? 0) >= 2 && !!p?.koliUnit;
  };
  // satuan terbesar yang tersedia → jadi default saat pilih product
  const biggestUnit = (pid: string): RUnit => (hasKoli(pid) ? "koli" : hasPack(pid) ? "pack" : "base");
  // faktor konversi ke satuan dasar untuk 1 product+satuan
  const factorOf = (pid: string, u: RUnit) => {
    const p = prodOf(pid);
    if (u === "koli" && hasKoli(pid)) return (p?.packSize ?? 1) * (p?.koliSize ?? 1);
    if (u === "pack" && hasPack(pid)) return p?.packSize ?? 1;
    return 1;
  };
  // tampilkan jumlah dalam SATUAN UTAMA (box) + sisa satuan kecil — TANPA pecahan.
  // ex: 232 sachet, 1 box = 16 sachet → "14 box 8 sachet". 240 → "15 box". 48 → "3 box".
  const fmtQty = (pid: string, base: number) => {
    const p = prodOf(pid);
    const smallUnit = p?.unit || "unit";
    const n = Math.max(0, Math.floor(base));
    if (!hasPack(pid)) return `${n} ${smallUnit}`;
    const size = p?.packSize ?? 1;
    const box = Math.floor(n / size);
    const rem = n % size;
    const parts: string[] = [];
    if (box > 0 || rem === 0) parts.push(`${box} ${p?.packUnit}`);
    if (rem > 0) parts.push(`${rem} ${smallUnit}`);
    return parts.join(" ");
  };

  function setItem(i: number, key: keyof RItem, val: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
    setError(undefined);
  }
  const addRow = () => setItems((prev) => [...prev, { productId: "", qty: "1", cost: "", unit: "base" }]);
  const removeRow = (i: number) => setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  const setUnit = (i: number, u: RUnit) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, unit: u } : it)));
  const chooseProduct = (i: number, v: string) => {
    const u = biggestUnit(v); // default ke satuan terbesar (koli › box › sachet)
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, productId: v, unit: u } : it)));
    setError(undefined);
  };

  const clean = items
    .map((it) => ({
      productId: it.productId,
      qty: Math.max(1, Math.floor(Number(it.qty) || 0)),
      cost: Math.max(0, Math.floor(Number(it.cost) || 0)),
      unit: it.unit,
    }))
    .filter((it) => it.productId && it.qty >= 1);

  function validate(e: FormEvent<HTMLFormElement>) {
    if (clean.length === 0) {
      e.preventDefault();
      setError("Tambah minimal 1 product dengan jumlah.");
    } else setError(undefined);
  }

  // Bungkus server action → setelah tersimpan, kosongkan lagi form-nya.
  async function submit(formData: FormData) {
    await action(formData);
    setItems([{ productId: "", qty: "1", cost: "", unit: "base" }]);
    setError(undefined);
  }

  if (products.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500">
        Tambah product dulu di Master Product, baru bisa catat barang masuk.
      </p>
    );
  }

  return (
    <form action={submit} onSubmit={validate} noValidate className="space-y-5 p-5">
      <input type="hidden" name="items" value={JSON.stringify(clean)} />

      <Field label="Tanggal masuk">
        <div className="sm:max-w-[15rem]">
          <DatePicker name="tanggal" defaultValue={today} />
        </div>
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Product masuk</span>
          {error && <span className="text-xs font-medium text-red-500">{error}</span>}
        </div>
        <p className="text-xs text-slate-400">
          Pilih product, isi jumlah & satuannya. Harga beli/unit opsional — isi kalau harganya berubah supaya
          rata-rata HPP ikut ter-update.
        </p>

        {items.map((it, i) => {
          const p = prodOf(it.productId);
          const baseUnit = p?.unit || "unit";
          const qtyNum = Math.max(0, Math.floor(Number(it.qty) || 0));
          const factor = factorOf(it.productId, it.unit);
          const addBase = qtyNum * factor;
          const cur = p?.current ?? 0;
          const lbl = "mb-1 block text-[11px] font-medium text-slate-500";
          // tier satuan yang tersedia, terbesar → terkecil (koli › box › sachet)
          const tiers: { u: RUnit; label: string }[] = [];
          if (hasKoli(it.productId)) tiers.push({ u: "koli", label: p?.koliUnit || "koli" });
          if (hasPack(it.productId)) tiers.push({ u: "pack", label: p?.packUnit || "box" });
          tiers.push({ u: "base", label: baseUnit });
          return (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className={lbl}>Product</label>
                  <Select
                    value={it.productId}
                    onValueChange={(v) => chooseProduct(i, v)}
                    placeholder="Pilih product…"
                    options={products}
                    searchable
                  />
                </div>
                <div className="flex gap-2">
                  <div>
                    <label className={lbl}>Jumlah</label>
                    <input
                      aria-label="Jumlah masuk"
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={(e) => setItem(i, "qty", e.target.value)}
                      className="h-10 w-20 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Satuan</label>
                    {tiers.length > 1 ? (
                      <div className="flex h-10 overflow-hidden rounded-lg border border-slate-300 text-xs">
                        {tiers.map((t) => (
                          <button
                            key={t.u}
                            type="button"
                            onClick={() => setUnit(i, t.u)}
                            className={it.unit === t.u ? "bg-indigo-600 px-3 font-medium text-white" : "px-3 text-slate-600 hover:bg-slate-50"}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
                        {baseUnit}
                      </div>
                    )}
                  </div>
                </div>
                <div className="sm:w-40">
                  <label className={lbl}>
                    Harga beli/unit <span className="text-slate-400">(opsional)</span>
                  </label>
                  <CurrencyInput
                    value={Number(it.cost) || 0}
                    onValueChange={(n) => setItem(i, "cost", String(n))}
                    placeholder="0"
                    className="h-10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={items.length === 1}
                  aria-label="Hapus baris"
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:flex"
                >
                  <X size={16} />
                </button>
              </div>

              {/* preview stok + hapus (mobile) */}
              <div className="mt-2.5 flex items-center justify-between gap-2">
                {p ? (
                  <p className="text-xs text-slate-500">
                    Stok sekarang: <span className="font-medium text-slate-700">{fmtQty(it.productId, cur)}</span>
                    {addBase > 0 && (
                      <> → jadi <span className="font-semibold text-emerald-600">{fmtQty(it.productId, cur + addBase)}</span></>
                    )}
                  </p>
                ) : (
                  <span className="text-xs text-slate-400">Belum pilih product</span>
                )}
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={items.length === 1}
                  className="text-xs font-medium text-red-500 hover:underline disabled:opacity-30 sm:hidden"
                >
                  Hapus
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addRow}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 sm:w-auto"
        >
          <Plus size={15} /> Tambah product
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <SubmitButton
          variant="primary"
          icon={<PackagePlus size={16} />}
          pendingText="Menyimpan…"
          notify="Barang masuk tercatat"
          className="w-full justify-center sm:w-auto"
        >
          Catat Barang Masuk
        </SubmitButton>
      </div>
    </form>
  );
}

// ---------- Opname massal (hitung banyak product sekaligus) ----------
type BulkItem = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  packUnit: string;
  packSize: number;
  current: number;
  known: boolean;
};

export function BulkOpnamePanel({ items, action }: { items: BulkItem[]; action: Action }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, "base" | "pack">>({});
  const [query, setQuery] = useState("");

  const setCount = (id: string, v: string) => setCounts((c) => ({ ...c, [id]: v }));
  const setU = (id: string, u: "base" | "pack") => setUnits((m) => ({ ...m, [id]: u }));
  const hasPk = (it: BulkItem) => it.packSize >= 2 && !!it.packUnit;
  const unitOf = (it: BulkItem): "base" | "pack" => units[it.productId] ?? (hasPk(it) ? "pack" : "base");
  const factorOf = (it: BulkItem) => (unitOf(it) === "pack" && hasPk(it) ? it.packSize : 1);

  // hanya baris yang diisi → dikirim (dengan satuan terpilih; konversi di server)
  const filled = items
    .filter((it) => (counts[it.productId] ?? "").trim() !== "")
    .map((it) => ({
      productId: it.productId,
      counted: Math.max(0, Math.floor(Number(counts[it.productId]) || 0)),
      unit: unitOf(it),
    }));

  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)) : items;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ClipboardList size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Opname Massal</h2>
            <p className="mt-0.5 text-xs text-slate-500">Hitung fisik banyak product sekaligus, simpan sekali.</p>
          </div>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form action={action} className="border-t border-slate-100 p-5">
          <input type="hidden" name="items" value={JSON.stringify(filled)} />

          {/* cari product (untuk daftar panjang) */}
          <div className="relative mb-3">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau SKU…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Bersihkan"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="max-h-[21rem] space-y-1 overflow-auto pr-1">
            {shown.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-400">Tidak ada product yang cocok.</p>
            ) : (
              shown.map((it) => {
                const v = counts[it.productId] ?? "";
                const u = unitOf(it);
                const counted = v.trim() === "" ? null : Math.max(0, Math.floor(Number(v) || 0));
                const baseCounted = counted !== null ? counted * factorOf(it) : null;
                const selisih = baseCounted !== null && it.known ? baseCounted - it.current : null;
                return (
                  <div key={it.productId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{it.name}</p>
                      <p className="font-mono text-[11px] text-slate-400">{it.sku}</p>
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs text-slate-500">
                      {it.known ? `${it.current} ${it.unit}` : "belum opname"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={v}
                      onChange={(e) => setCount(it.productId, e.target.value)}
                      placeholder="fisik"
                      className="h-9 w-16 shrink-0 rounded-lg border border-slate-300 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    {hasPk(it) ? (
                      <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setU(it.productId, "pack")}
                          className={u === "pack" ? "bg-indigo-600 px-1.5 py-1.5 font-medium text-white" : "px-1.5 py-1.5 text-slate-600 hover:bg-slate-50"}
                        >
                          {it.packUnit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setU(it.productId, "base")}
                          className={u === "base" ? "bg-indigo-600 px-1.5 py-1.5 font-medium text-white" : "px-1.5 py-1.5 text-slate-600 hover:bg-slate-50"}
                        >
                          {it.unit}
                        </button>
                      </div>
                    ) : (
                      <span className="w-10 shrink-0 text-[11px] text-slate-400">{it.unit}</span>
                    )}
                    <span className="w-12 shrink-0 text-right text-xs">
                      {selisih === null ? (
                        <span className="text-slate-300">—</span>
                      ) : selisih === 0 ? (
                        <span className="font-medium text-emerald-600">cocok</span>
                      ) : (
                        <span className={`font-semibold ${selisih > 0 ? "text-blue-600" : "text-red-600"}`}>
                          {selisih > 0 ? `+${selisih}` : selisih}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">{filled.length} product diisi</span>
            <SubmitButton variant="primary" disabled={filled.length === 0} pendingText="Menyimpan…" notify="Opname massal tersimpan">
              Simpan Opname ({filled.length})
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------- Sel opname (hitung fisik + selisih) ----------
export function OpnameCell({
  productId,
  current,
  known,
  unit,
  packUnit,
  packSize,
  action,
}: {
  productId: string;
  current: number;
  known: boolean; // ada stok sistem sebagai acuan (sudah opname / ada barang masuk)
  unit: string;
  packUnit: string;
  packSize: number;
  action: Action;
}) {
  const hasPack = packSize >= 2 && !!packUnit;
  const [val, setVal] = useState("");
  const [u, setU] = useState<"base" | "pack">(hasPack ? "pack" : "base");
  const factor = u === "pack" && hasPack ? packSize : 1;
  const counted = val.trim() === "" ? null : Math.max(0, Math.floor(Number(val) || 0));
  const baseCounted = counted !== null ? counted * factor : null;
  // Selisih (satuan dasar) hanya berarti kalau ada stok sistem sebagai acuan.
  const selisih = baseCounted !== null && known ? baseCounted - current : null;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="unit" value={u} />
      <input
        name="countedQty"
        type="number"
        min="0"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={known ? "fisik…" : "stok awal…"}
        className="h-9 w-20 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      {hasPack ? (
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300 text-[11px]">
          <button
            type="button"
            onClick={() => setU("pack")}
            className={u === "pack" ? "bg-indigo-600 px-1.5 py-1.5 font-medium text-white" : "px-1.5 py-1.5 text-slate-600 hover:bg-slate-50"}
          >
            {packUnit}
          </button>
          <button
            type="button"
            onClick={() => setU("base")}
            className={u === "base" ? "bg-indigo-600 px-1.5 py-1.5 font-medium text-white" : "px-1.5 py-1.5 text-slate-600 hover:bg-slate-50"}
          >
            {unit}
          </button>
        </div>
      ) : (
        <span className="shrink-0 text-[11px] text-slate-400">{unit}</span>
      )}
      <span className="w-20 shrink-0 text-xs">
        {!known ? (
          <span className="text-slate-400">stok awal</span>
        ) : selisih === null ? (
          <span className="text-slate-300">selisih</span>
        ) : selisih === 0 ? (
          <span className="font-medium text-emerald-600">cocok</span>
        ) : (
          <span className={`font-semibold ${selisih > 0 ? "text-blue-600" : "text-red-600"}`}>
            {selisih > 0 ? `+${selisih}` : selisih}
          </span>
        )}
      </span>
      <SubmitButton
        variant={counted === null ? "outline" : "primary"}
        disabled={counted === null}
        className="h-9 py-0 text-xs"
        pendingText="…"
        notify="Opname tersimpan"
      >
        {known ? "Opname" : "Set"}
      </SubmitButton>
    </form>
  );
}

// ---------- Sel ambang minimum (low-stock) ----------
export function MinStockCell({
  productId,
  minStock,
  action,
}: {
  productId: string;
  minStock: number;
  action: Action;
}) {
  const [val, setVal] = useState(String(minStock));
  const dirty = val !== String(minStock);

  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="productId" value={productId} />
      <input
        name="minStock"
        type="number"
        min="0"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      <SubmitButton
        variant={dirty ? "primary" : "outline"}
        disabled={!dirty}
        className="h-9 px-2 py-0 text-xs"
        pendingText="…"
      >
        {dirty ? "Simpan" : "OK"}
      </SubmitButton>
    </form>
  );
}

// ---------- Cari + filter stok menipis + sort ----------
export function StockControls({ q, low, sort }: { q: string; low: boolean; sort: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState(q);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (text) next.set("q", text);
      else next.delete("q");
      next.delete("page");
      router.push(`/stok?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function toggleLow() {
    const next = new URLSearchParams(params.toString());
    if (low) next.delete("low");
    else next.set("low", "1");
    next.delete("page");
    router.push(`/stok?${next.toString()}`, { scroll: false });
  }

  function toggleSort() {
    const next = new URLSearchParams(params.toString());
    if (sort === "stock") next.delete("sort");
    else next.set("sort", "stock");
    next.delete("page");
    router.push(`/stok?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cari nama atau SKU…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-56"
        />
        {text && (
          <button
            type="button"
            onClick={() => setText("")}
            aria-label="Bersihkan"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={toggleLow}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
          low
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <ClipboardCheck size={15} />
        Stok menipis
      </button>
      <button
        type="button"
        onClick={toggleSort}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
          sort === "stock"
            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <ArrowUpNarrowWide size={15} />
        Stok terendah
      </button>
    </div>
  );
}
