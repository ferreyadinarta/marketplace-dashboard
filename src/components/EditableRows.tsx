"use client";

import { useState } from "react";
import { Pencil, Copy, Sparkles } from "lucide-react";
import { Select, type SelectOption, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CurrencyInput } from "@/components/CurrencyInput";
import { DeleteProductButton } from "@/components/ProductControls";
import { BundleEditor } from "@/components/BundleEditor";
import { rupiah } from "@/lib/format";

type Action = (formData: FormData) => void | Promise<void>;

// ---------- Kartu Product (Master Product) — expandable editor ----------
export function ProductRow({
  id,
  name,
  sku,
  hpp,
  priceRetail,
  priceGrosir,
  unit,
  packUnit,
  packSize,
  koliUnit,
  koliSize,
  groupId,
  groupName,
  groupOptions,
  isBundle,
  components,
  productOptions,
  updateAction,
  bundleAction,
  deleteAction,
  duplicateAction,
}: {
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
  groupId: string;
  groupName?: string;
  groupOptions: SelectOption[];
  isBundle: boolean;
  components: { componentId: string; qty: number }[];
  productOptions: SelectOption[]; // product lain (calon isi bundle)
  updateAction: Action;
  bundleAction: Action;
  deleteAction: Action;
  duplicateAction: Action;
}) {
  const [open, setOpen] = useState(false);
  // tampilan "box-first": satuan utama = pack kalau ada, kecil = base
  const [mainUnit, setMainUnit] = useState(packSize > 0 ? packUnit : unit);
  const [smallUnit, setSmallUnit] = useState(packSize > 0 ? unit : "");
  // default "koli" (satuan terbesar hampir selalu koli), tetap bisa diganti user.
  // Kalau isi koli tidak diisi, teks ini diabaikan → aman.
  const [koliU, setKoliU] = useState(koliUnit || "koli");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{name}</p>
          <p className="font-mono text-xs text-slate-500">{sku}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
            <span>HPP <b className="text-slate-700">{rupiah(hpp)}</b></span>
            <span>Retail <b className="text-slate-700">{rupiah(priceRetail)}</b></span>
            <span>Grosir <b className="text-slate-700">{rupiah(priceGrosir)}</b></span>
            <span>Satuan <b className="text-slate-700">{mainUnit}</b></span>
            {packSize > 0 && (
              <span>
                1 {packUnit} = <b className="text-slate-700">{packSize} {unit}</b>
              </span>
            )}
            {koliSize > 0 && (
              <span>
                1 {koliUnit} = <b className="text-slate-700">{koliSize} {packUnit}</b>
              </span>
            )}
            {groupName && <span>Grup <b className="text-slate-700">{groupName}</b></span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              open ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Pencil size={14} /> {open ? "Tutup" : "Edit"}
          </button>
          <form action={duplicateAction}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              title="Duplikat product"
              aria-label={`Duplikat ${name}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Copy size={15} />
            </button>
          </form>
          <DeleteProductButton id={id} name={name} action={deleteAction} />
        </div>
      </div>

      {open && (
        <form
          action={updateAction}
          className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input type="hidden" name="id" value={id} />
          <Field label="Nama product">
            <input
              name="name"
              defaultValue={name}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="SKU internal" hint="Kode unik product. Kalau bentrok dengan SKU lain, perubahan SKU diabaikan.">
            <input
              name="sku"
              defaultValue={sku}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="HPP / Modal (Rp)" hint="Harga modal / beli per unit. Dipakai untuk menghitung profit (bukan harga jual).">
            <CurrencyInput name="hpp" defaultValue={hpp} />
          </Field>
          <Field label="Harga retail (Rp)" hint="Harga jual eceran ke pembeli langsung. Jadi default saat mencatat penjualan WA/offline.">
            <CurrencyInput name="priceRetail" defaultValue={priceRetail} />
          </Field>
          <Field label="Harga grosir (Rp)" hint="Harga jual ke reseller/toko (lebih murah). Jadi default saat mencatat penjualan grosir.">
            <CurrencyInput name="priceGrosir" defaultValue={priceGrosir} />
          </Field>
          <Field label="Satuan utama" hint="Satuan yang biasa dipakai (mis. box, botol, pcs).">
            <input
              name="mainUnit"
              value={mainUnit}
              onChange={(e) => setMainUnit(e.target.value)}
              placeholder="box"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="Satuan kecil (opsional)" hint="Kalau kadang dijual eceran lebih kecil (mis. sachet). Kosongkan kalau tidak ada.">
            <input
              name="smallUnit"
              value={smallUnit}
              onChange={(e) => setSmallUnit(e.target.value)}
              placeholder="sachet"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field
            label={`Isi (1 ${mainUnit.trim() || "utama"} = ? ${smallUnit.trim() || "kecil"})`}
            hint="Contoh: 1 box = 12 sachet → isi 12. Kosong/0 kalau tanpa satuan kecil."
          >
            <input
              name="isi"
              type="number"
              min="0"
              defaultValue={packSize || ""}
              placeholder="12"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="Satuan koli (opsional)" hint="Satuan terbesar saat barang masuk (mis. koli = dus isi beberapa box). Kosongkan kalau tidak ada.">
            <input
              name="koliUnit"
              value={koliU}
              onChange={(e) => setKoliU(e.target.value)}
              placeholder="koli"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field
            label={`Isi koli (1 ${koliU.trim() || "koli"} = ? ${mainUnit.trim() || "box"})`}
            hint="Contoh: 1 koli = 6 box → isi 6. Butuh satuan kecil/isi dulu (koli dihitung dari box)."
          >
            <input
              name="isiKoli"
              type="number"
              min="0"
              defaultValue={koliSize || ""}
              placeholder="6"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="Grup pembukuan">
            <Select name="groupId" defaultValue={groupId} placeholder="— Tanpa grup —" options={groupOptions} />
          </Field>
          <div className="flex items-end">
            <SubmitButton variant="primary" pendingText="Menyimpan…" notify="Product tersimpan">
              Simpan
            </SubmitButton>
          </div>
        </form>
      )}

      {/* Bundle (isi gabungan): form terpisah karena aksinya beda.
          Dipakai untuk listing "mix" — 1 box berisi beberapa product sekaligus. */}
      {open && (
        <BundleEditor
          productId={id}
          initialIsBundle={isBundle}
          initialComponents={components}
          productOptions={productOptions}
          action={bundleAction}
        />
      )}
    </div>
  );
}

// ---------- Baris Mapping SKU ----------
// Satu product DASAR bisa punya banyak varian marketplace ("1 box" vs "10 sachet"),
// jadi selain product-nya, baris ini juga menyimpan ISI per unit yang dijual.
//
// Yang DISIMPAN selalu satuan dasar (sachet). Tapi mengetik "24" untuk varian
// 2 BOX gampang salah, jadi input-nya sama seperti Stok Opname: angka + toggle
// satuan (koli › box › sachet) mengikuti satuan product yang dipilih.
export type MappingUnitInfo = {
  unit: string; // satuan dasar (mis. sachet)
  packUnit: string; // mis. box
  packSize: number; // 1 box = berapa sachet
  koliUnit: string;
  koliSize: number; // 1 koli = berapa box
};

type Tier = { key: string; label: string; factor: number };

// Tingkatan satuan yang tersedia untuk product ini, terbesar → terkecil.
function tiersOf(u?: MappingUnitInfo): Tier[] {
  const out: Tier[] = [];
  if (!u) return [{ key: "base", label: "satuan dasar", factor: 1 }];
  const hasPack = u.packSize >= 2 && !!u.packUnit;
  const hasKoli = hasPack && u.koliSize >= 2 && !!u.koliUnit;
  if (hasKoli) out.push({ key: "koli", label: u.koliUnit, factor: u.koliSize * u.packSize });
  if (hasPack) out.push({ key: "pack", label: u.packUnit, factor: u.packSize });
  out.push({ key: "base", label: u.unit || "satuan dasar", factor: 1 });
  return out;
}

// Pilih tampilan paling enak dibaca untuk nilai tersimpan: 24 sachet dengan
// 1 box = 12 → tampil "2 box". Kalau tidak habis dibagi, tetap satuan dasar.
function splitBase(base: number, tiers: Tier[]): { qty: number; tier: string } {
  for (const t of tiers) {
    if (t.factor > 1 && base % t.factor === 0) return { qty: base / t.factor, tier: t.key };
  }
  return { qty: base, tier: "base" };
}

export function MappingRow({
  mappingId,
  initialProductId,
  initialBaseQty,
  unitInfo,
  suggestion,
  options,
  action,
}: {
  mappingId: string;
  initialProductId: string;
  initialBaseQty: number;
  unitInfo?: Record<string, MappingUnitInfo>; // per productId — ikut dropdown, bukan cuma yang tersimpan
  suggestion?: { productId: string; productName: string; baseQty: number } | null;
  options: SelectOption[];
  action: Action;
}) {
  const [value, setValue] = useState(initialProductId);
  const tiers = tiersOf(unitInfo?.[value]);

  const init = splitBase(Math.max(1, initialBaseQty || 1), tiers);
  const [qty, setQty] = useState(String(init.qty));
  const [tier, setTier] = useState(init.tier);

  const factor = tiers.find((t) => t.key === tier)?.factor ?? 1;
  const baseQty = Math.max(1, Math.floor(Number(qty) || 0)) * factor;
  const baseUnit = tiers[tiers.length - 1].label;
  const dirty = value !== initialProductId || baseQty !== (initialBaseQty || 1);

  // ganti product → satuannya bisa beda; pertahankan jumlah dalam satuan dasar
  const chooseProduct = (next: string) => {
    const nextTiers = tiersOf(unitInfo?.[next]);
    const s = splitBase(baseQty, nextTiers);
    setValue(next);
    setQty(String(s.qty));
    setTier(s.tier);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    const nextTiers = tiersOf(unitInfo?.[suggestion.productId]);
    const s = splitBase(Math.max(1, suggestion.baseQty), nextTiers);
    setValue(suggestion.productId);
    setQty(String(s.qty));
    setTier(s.tier);
  };

  return (
    <form action={action} className="w-full space-y-1.5">
      <input type="hidden" name="mappingId" value={mappingId} />
      {/* yang dikirim ke server tetap satuan dasar */}
      <input type="hidden" name="baseQtyPerUnit" value={baseQty} />

      {/* saran otomatis — DI ATAS input-nya supaya jelas milik baris ini,
          dan hanya muncul selama belum dipetakan */}
      {suggestion && !value && (
        <button
          type="button"
          onClick={applySuggestion}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-left text-xs text-indigo-700 hover:bg-indigo-100"
        >
          <Sparkles size={12} className="shrink-0" />
          <span className="truncate">
            Saran: <b>{suggestion.productName}</b> · isi {suggestion.baseQty}
          </span>
          <span className="shrink-0 font-semibold underline">Pakai</span>
        </button>
      )}

      <div className="flex w-full items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select
            name="productId"
            value={value}
            onValueChange={chooseProduct}
            placeholder="— Belum dipetakan —"
            className="w-full"
            options={options}
            searchable
          />
        </div>

        {/* Isi baru berarti kalau product-nya sudah dipilih — sebelum itu
            satuannya belum diketahui, jadi kolomnya disembunyikan biar bersih. */}
        {value && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
            isi
            <input
              aria-label="Isi per unit yang dijual"
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              title={`Berapa banyak untuk 1 unit yang dijual di marketplace (disimpan sebagai ${baseUnit})`}
              className="h-9 w-14 rounded-lg border border-slate-300 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {tiers.length > 1 ? (
              <div className="flex h-9 overflow-hidden rounded-lg border border-slate-300 text-[11px]">
                {tiers.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTier(t.key)}
                    className={
                      tier === t.key
                        ? "bg-indigo-600 px-2 font-medium text-white"
                        : "px-2 text-slate-600 hover:bg-slate-50"
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="whitespace-nowrap text-slate-400">{baseUnit}</span>
            )}
          </div>
        )}
        <SubmitButton
          variant={dirty ? "primary" : "ghost"}
          disabled={!dirty}
          className={`w-20 shrink-0 justify-center px-2 py-2 text-xs ${dirty ? "ring-2 ring-indigo-200" : "text-slate-400"}`}
          pendingText="…"
        >
          {dirty ? "Simpan" : "Tersimpan"}
        </SubmitButton>
      </div>

      {/* total dalam satuan dasar — cuma perlu ditampilkan kalau bukan 1:1 */}
      {value && factor > 1 && (
        <p className="text-[11px] text-slate-400">
          = {baseQty} {baseUnit} per 1 unit terjual
        </p>
      )}

    </form>
  );
}
