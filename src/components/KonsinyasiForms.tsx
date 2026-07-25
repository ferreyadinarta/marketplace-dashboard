"use client";

import { useState, type FormEvent } from "react";
import { Plus, Store as StoreIcon } from "lucide-react";
import { Field, inputClass, inputErrorClass, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type Option = { value: string; label: string };
type Action = (formData: FormData) => void | Promise<void>;

// Tambah toko konsinyasi (tempat titip jual)
export function AddKonsinyasiStoreForm({ action }: { action: Action }) {
  const [error, setError] = useState<string | undefined>();

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("name") ?? "").trim()) {
      e.preventDefault();
      setError("Nama toko wajib diisi.");
    } else setError(undefined);
  }

  return (
    <form action={action} onSubmit={validate} noValidate className="flex flex-wrap items-end gap-3 p-5">
      <Field label="Nama toko konsinyasi" error={error}>
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

// Catat penjualan konsinyasi
export function KonsinyasiSaleForm({
  stores,
  products,
  action,
  today,
}: {
  stores: Option[];
  products: Option[];
  action: Action;
  today: string;
}) {
  const [errors, setErrors] = useState<{ storeId?: string; productId?: string }>({});

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const errs: { storeId?: string; productId?: string } = {};
    if (!String(fd.get("storeId") ?? "")) errs.storeId = "Pilih toko.";
    if (!String(fd.get("productId") ?? "")) errs.productId = "Pilih product.";
    if (Object.keys(errs).length) {
      e.preventDefault();
      setErrors(errs);
    } else setErrors({});
  }

  if (stores.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500">
        Tambah toko konsinyasi dulu di atas, baru bisa catat penjualan.
      </p>
    );
  }

  return (
    <form action={action} onSubmit={validate} noValidate className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Toko konsinyasi" error={errors.storeId}>
        <Select
          name="storeId"
          placeholder="Pilih toko…"
          options={stores}
          onValueChange={() => setErrors((s) => ({ ...s, storeId: undefined }))}
        />
      </Field>
      <Field label="Product" error={errors.productId}>
        <Select
          name="productId"
          placeholder="Pilih product…"
          options={products}
          onValueChange={() => setErrors((s) => ({ ...s, productId: undefined }))}
        />
      </Field>
      <Field label="Tanggal">
        <input name="tanggal" type="date" defaultValue={today} className={`${inputClass} [color-scheme:light]`} />
      </Field>
      <Field label="Nama pembeli (opsional)">
        <input name="buyerName" placeholder="ex: Bu Ani" className={inputClass} />
      </Field>
      <Field label="Jumlah terjual">
        <input name="qty" type="number" min="1" defaultValue={1} className={inputClass} />
      </Field>
      <Field label="Harga jual / unit (Rp)" hint="Harga yang kamu terima per unit.">
        <input name="price" type="number" min="0" placeholder="0" className={inputClass} />
      </Field>
      <Field label="Komisi / potongan toko (Rp)" hint="Total potongan/bagi hasil untuk toko titipan. Kosongkan kalau tidak ada.">
        <input name="komisi" type="number" min="0" placeholder="0" className={inputClass} />
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <SubmitButton variant="primary" icon={<Plus size={16} />} pendingText="Menyimpan…">
          Catat Penjualan
        </SubmitButton>
      </div>
    </form>
  );
}
