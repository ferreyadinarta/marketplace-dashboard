"use client";

import { useState } from "react";
import { Pencil, Copy } from "lucide-react";
import { Select, type SelectOption, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CurrencyInput } from "@/components/CurrencyInput";
import { DeleteProductButton } from "@/components/ProductControls";
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
  updateAction,
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
  updateAction: Action;
  deleteAction: Action;
  duplicateAction: Action;
}) {
  const [open, setOpen] = useState(false);
  // tampilan "box-first": satuan utama = pack kalau ada, kecil = base
  const [mainUnit, setMainUnit] = useState(packSize > 0 ? packUnit : unit);
  const [smallUnit, setSmallUnit] = useState(packSize > 0 ? unit : "");
  const [koliU, setKoliU] = useState(koliUnit ?? "");

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
    </div>
  );
}

// ---------- Baris Mapping SKU ----------
export function MappingRow({
  mappingId,
  initialProductId,
  options,
  action,
}: {
  mappingId: string;
  initialProductId: string;
  options: SelectOption[];
  action: Action;
}) {
  const [value, setValue] = useState(initialProductId);
  const dirty = value !== initialProductId;

  return (
    <form action={action} className="flex w-full items-center gap-2">
      <input type="hidden" name="mappingId" value={mappingId} />
      <Select
        name="productId"
        value={value}
        onValueChange={setValue}
        placeholder="— Belum dipetakan —"
        className="w-64"
        options={options}
      />
      <SubmitButton
        variant={dirty ? "primary" : "outline"}
        disabled={!dirty}
        className={`ml-auto w-24 shrink-0 justify-center px-3 py-2 text-xs ${dirty ? "ring-2 ring-indigo-200" : ""}`}
        pendingText="…"
      >
        {dirty ? "Simpan" : "Tersimpan"}
      </SubmitButton>
    </form>
  );
}
