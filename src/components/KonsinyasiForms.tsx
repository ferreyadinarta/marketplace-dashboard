"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Plus, Store as StoreIcon, X } from "lucide-react";
import { Field, inputClass, inputErrorClass, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { DatePicker } from "@/components/DatePicker";
import { CurrencyInput } from "@/components/CurrencyInput";
import { rupiah } from "@/lib/format";

type Option = { value: string; label: string };
type Action = (formData: FormData) => void | Promise<void>;

// Tambah toko / reseller (tempat jual putus grosir)
export function AddKonsinyasiStoreForm({
  action,
  existingNames = [],
}: {
  action: Action;
  existingNames?: string[];
}) {
  const [error, setError] = useState<string | undefined>();

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      e.preventDefault();
      setError("Nama toko wajib diisi.");
    } else if (existingNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      e.preventDefault();
      setError("Toko/reseller ini sudah ada.");
    } else setError(undefined);
  }

  return (
    <form action={action} onSubmit={validate} noValidate className="flex flex-wrap items-end gap-3 p-5">
      <Field label="Nama toko / reseller" error={error}>
        <input
          name="name"
          onInput={() => error && setError(undefined)}
          placeholder="ex: Istana Buah SA"
          className={`w-72 max-w-full ${inputClass.replace("w-full", "")} ${error ? inputErrorClass : ""}`}
        />
      </Field>
      <SubmitButton variant="outline" icon={<StoreIcon size={16} />} pendingText="Menyimpan…">
        Tambah Toko
      </SubmitButton>
    </form>
  );
}

// Chip toko/reseller dengan tombol hapus + konfirmasi (warning kalau ada penjualan).
export function StoreChip({
  store,
  deleteAction,
}: {
  store: { id: string; name: string; count: number };
  deleteAction: Action;
}) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setAlignRight(r.left + 260 > window.innerWidth - 8);
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex max-w-full">
      <span className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-3 pr-1 text-xs font-medium text-slate-600">
        <span className="truncate">{store.name}</span>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Hapus ${store.name}`}
          className="shrink-0 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
        >
          <X size={12} />
        </button>
      </span>
      {open && (
        <div
          className={`absolute top-full z-30 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          <p className="text-xs leading-relaxed text-slate-600 [overflow-wrap:anywhere]">
            Hapus toko <span className="font-semibold text-slate-800">{store.name}</span>?
            {store.count > 0 && (
              <>
                {" "}
                <span className="font-medium text-red-600">{store.count} penjualan</span> toko ini ikut terhapus permanen.
              </>
            )}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Batal
            </button>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={store.id} />
              <SubmitButton variant="danger" className="px-2.5 py-1 text-xs" pendingText="…">
                Hapus
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

type ProductOption = {
  value: string;
  label: string;
  unit?: string;
  packUnit?: string;
  packSize?: number;
  stock?: number | null; // null = belum di-opname / untracked (dalam satuan dasar)
  priceRetail?: number;
  priceGrosir?: number;
};
type Item = { productId: string; qty: string; price: string; unit: "base" | "pack" };

const cellInput =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 [color-scheme:light]";

// Form penjualan manual dengan BANYAK product dalam 1 order (WA/offline atau grosir).
// Satu order = satu toko/pembeli + satu tanggal + beberapa baris product.
export function MultiItemSaleForm({
  variant,
  products,
  stores,
  action,
  today,
}: {
  variant: "wa" | "grosir";
  products: ProductOption[];
  stores?: Option[];
  action: Action;
  today: string;
}) {
  const isGrosir = variant === "grosir";
  const prodOf = (pid: string) => products.find((p) => p.value === pid);
  const unitOf = (pid: string) => prodOf(pid)?.unit || "";
  const hasPack = (pid: string) => {
    const p = prodOf(pid);
    return !!p && (p.packSize ?? 0) >= 2 && !!p.packUnit;
  };
  // label satuan yang sedang dipilih (base = satuan dasar, pack = satuan besar)
  const unitLabel = (it: Item) => {
    const p = prodOf(it.productId);
    if (!p) return "unit";
    return it.unit === "pack" && hasPack(it.productId) ? p.packUnit! : p.unit || "unit";
  };
  // faktor konversi ke satuan dasar (pack → packSize, base → 1)
  const factorOf = (it: Item) => (it.unit === "pack" && hasPack(it.productId) ? prodOf(it.productId)!.packSize! : 1);
  // harga default per satuan yang dipilih
  const defaultPrice = (pid: string, unit: "base" | "pack") => {
    const p = prodOf(pid);
    const basePrice = isGrosir ? p?.priceGrosir ?? 0 : p?.priceRetail ?? 0;
    return unit === "pack" && hasPack(pid) ? basePrice * (p!.packSize || 1) : basePrice;
  };
  const [storeId, setStoreId] = useState("");
  const [items, setItems] = useState<Item[]>([{ productId: "", qty: "1", price: "", unit: "base" }]);
  const [errors, setErrors] = useState<{ store?: string; items?: string }>({});

  if (isGrosir && (!stores || stores.length === 0)) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500">
        Tambah toko / reseller dulu di atas, baru bisa catat penjualan.
      </p>
    );
  }
  if (products.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500">
        Tambah product dulu di Master Product, baru bisa catat penjualan.
      </p>
    );
  }

  function setItem(i: number, key: keyof Item, val: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
    setErrors((s) => ({ ...s, items: undefined }));
  }
  // pilih product → default ke satuan UTAMA (pack kalau ada) + auto-isi harga
  function chooseProduct(i: number, v: string) {
    const u: "base" | "pack" = hasPack(v) ? "pack" : "base";
    const def = defaultPrice(v, u);
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, productId: v, unit: u, price: def > 0 ? String(def) : "" } : it))
    );
    setErrors((s) => ({ ...s, items: undefined }));
  }
  // ganti satuan (base ↔ pack) → sesuaikan harga default
  function chooseUnit(i: number, u: "base" | "pack") {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const def = defaultPrice(it.productId, u);
        return { ...it, unit: u, price: def > 0 ? String(def) : it.price };
      })
    );
  }
  function addRow() {
    setItems((prev) => [...prev, { productId: "", qty: "1", price: "", unit: "base" }]);
  }
  function removeRow(i: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  const cleanRaw = items
    .map((it) => ({
      productId: it.productId,
      qty: Math.max(1, Math.floor(Number(it.qty) || 0)),
      price: Math.max(0, Math.floor(Number(it.price) || 0)),
      unit: it.unit,
    }))
    .filter((it) => it.productId && it.qty >= 1);
  // gabung baris product+satuan yang sama (beda satuan tidak digabung)
  const seen = new Map<string, { productId: string; qty: number; price: number; unit: "base" | "pack" }>();
  for (const it of cleanRaw) {
    const key = `${it.productId}|${it.unit}`;
    const ex = seen.get(key);
    if (ex) ex.qty += it.qty;
    else seen.set(key, { ...it });
  }
  const clean = [...seen.values()];
  const hasDup = cleanRaw.length > clean.length;
  const grandTotal = clean.reduce((a, it) => a + it.price * it.qty, 0);

  function validate(e: FormEvent<HTMLFormElement>) {
    const errs: { store?: string; items?: string } = {};
    if (isGrosir && !storeId) errs.store = "Pilih toko.";
    if (clean.length === 0) errs.items = "Tambah minimal 1 product dengan jumlah.";
    if (Object.keys(errs).length) {
      e.preventDefault();
      setErrors(errs);
    } else setErrors({});
  }

  return (
    <form action={action} onSubmit={validate} noValidate className="space-y-5 p-5">
      <input type="hidden" name="items" value={JSON.stringify(clean)} />
      {isGrosir && <input type="hidden" name="storeId" value={storeId} />}

      {/* header order: toko (grosir), tanggal, pembeli */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isGrosir && (
          <Field label="Toko / reseller" error={errors.store}>
            <Select
              value={storeId}
              onValueChange={(v) => {
                setStoreId(v);
                setErrors((s) => ({ ...s, store: undefined }));
              }}
              placeholder="Pilih toko…"
              options={stores!}
              searchable
            />
          </Field>
        )}
        <Field label="Tanggal">
          <DatePicker name="tanggal" defaultValue={today} />
        </Field>
        {/* Grosir: toko/reseller sudah jadi identitas pembeli → tidak perlu nama lagi.
            WA: tidak ada toko, jadi nama pembeli berguna. */}
        {!isGrosir && (
          <Field label="Nama pembeli (opsional)">
            <input name="buyerName" placeholder="ex: Bu Ani" className={inputClass} />
          </Field>
        )}
      </div>

      {/* baris product (bisa lebih dari satu) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">
            Product — harga {isGrosir ? "grosir" : "retail"} <span className="text-slate-400">per unit</span>
          </span>
          {errors.items && <span className="text-xs font-medium text-red-500">{errors.items}</span>}
        </div>

        {items.map((it, i) => {
          const p = it.productId ? prodOf(it.productId) : undefined;
          const st = p?.stock;
          const factor = factorOf(it);
          const baseQty = Math.max(1, Math.floor(Number(it.qty) || 0)) * factor;
          const over = st != null && baseQty > st;
          const showPack = it.productId ? hasPack(it.productId) : false;
          return (
            <div key={i} className="rounded-xl border border-slate-200 p-2">
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <Select
                    value={it.productId}
                    onValueChange={(v) => chooseProduct(i, v)}
                    placeholder="Pilih product…"
                    options={products}
                    searchable
                  />
                </div>
                <input
                  aria-label="Jumlah"
                  type="number"
                  min="1"
                  value={it.qty}
                  onChange={(e) => setItem(i, "qty", e.target.value)}
                  placeholder="Qty"
                  className={`${cellInput} w-16 ${over ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
                />
                {showPack ? (
                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300 text-xs">
                    <button
                      type="button"
                      onClick={() => chooseUnit(i, "base")}
                      className={it.unit === "base" ? "bg-indigo-600 px-2 py-2 font-medium text-white" : "px-2 py-2 text-slate-600 hover:bg-slate-50"}
                    >
                      {p?.unit || "sat"}
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseUnit(i, "pack")}
                      className={it.unit === "pack" ? "bg-indigo-600 px-2 py-2 font-medium text-white" : "px-2 py-2 text-slate-600 hover:bg-slate-50"}
                    >
                      {p?.packUnit}
                    </button>
                  </div>
                ) : (
                  <span className="w-12 shrink-0 truncate text-xs text-slate-400" title={unitOf(it.productId)}>
                    {unitOf(it.productId) || "unit"}
                  </span>
                )}
                <div className="w-32 shrink-0">
                  <CurrencyInput
                    value={Number(it.price) || 0}
                    onValueChange={(n) => setItem(i, "price", String(n))}
                    placeholder="/unit"
                    className="h-10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={items.length === 1}
                  aria-label="Hapus baris"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>
              {it.productId && (
                <p className={`mt-1 pl-1 text-xs ${over ? "font-medium text-red-600" : "text-slate-400"}`}>
                  {st == null
                    ? "Stok belum di-opname"
                    : `Stok: ${st} ${p?.unit ?? ""}` +
                      (factor > 1 ? ` · jual ${it.qty} ${p?.packUnit} = ${baseQty} ${p?.unit}` : "") +
                      (over ? " — melebihi stok!" : "")}
                </p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
        >
          <Plus size={15} /> Tambah product
        </button>
      </div>

      {hasDup && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Ada product yang sama di beberapa baris — jumlahnya akan <strong>digabung otomatis</strong> saat disimpan.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-sm text-slate-500">
          Total: <strong className="text-slate-900">{rupiah(grandTotal)}</strong>
        </span>
        <SubmitButton variant="primary" icon={<Plus size={16} />} pendingText="Menyimpan…" notify="Penjualan tercatat">
          Catat Penjualan
        </SubmitButton>
      </div>
    </form>
  );
}
