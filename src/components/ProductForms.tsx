"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Plus, FolderPlus, X } from "lucide-react";
import { Field, inputClass, inputErrorClass, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CurrencyInput } from "@/components/CurrencyInput";

type Group = { id: string; name: string };
type Action = (formData: FormData) => void | Promise<void>;

// ---------- Tambah Product (validasi custom) ----------
export function AddProductForm({
  groups,
  action,
}: {
  groups: Group[];
  action: Action;
}) {
  const [errors, setErrors] = useState<{ name?: string; sku?: string }>({});
  const [mainUnit, setMainUnit] = useState("pcs");
  const [smallUnit, setSmallUnit] = useState("");

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const sku = String(fd.get("sku") ?? "").trim();
    const errs: { name?: string; sku?: string } = {};
    if (!name) errs.name = "Nama product wajib diisi.";
    if (!sku) errs.sku = "SKU internal wajib diisi.";
    if (Object.keys(errs).length) {
      e.preventDefault();
      setErrors(errs);
    } else {
      setErrors({});
    }
  }

  const clear = (k: "name" | "sku") =>
    setErrors((s) => ({ ...s, [k]: undefined }));

  return (
    <form
      action={action}
      onSubmit={validate}
      noValidate
      className="grid gap-4 p-5 sm:grid-cols-2"
    >
      <Field label="Nama product" error={errors.name}>
        <input
          name="name"
          onInput={() => errors.name && clear("name")}
          placeholder="ex: Flimty Fiber Blackcurrant"
          className={`${inputClass} ${errors.name ? inputErrorClass : ""}`}
        />
      </Field>
      <Field
        label="SKU internal"
        hint="Kode unik product versi kamu sendiri, bukan SKU marketplace."
        error={errors.sku}
      >
        <input
          name="sku"
          onInput={() => errors.sku && clear("sku")}
          placeholder="ex: FLM-FIBER-BC"
          className={`${inputClass} ${errors.sku ? inputErrorClass : ""}`}
        />
      </Field>
      <Field
        label="HPP / Modal (Rp)"
        hint="Harga Pokok Penjualan: modal untuk 1 unit product."
      >
        <CurrencyInput name="hpp" placeholder="0" />
      </Field>
      <Field label="Satuan utama" hint="Satuan yang biasa dipakai (mis. box, botol, pcs).">
        <input
          name="mainUnit"
          value={mainUnit}
          onChange={(e) => setMainUnit(e.target.value)}
          placeholder="ex: box"
          className={inputClass}
        />
      </Field>
      <Field label="Satuan kecil (opsional)" hint="Kalau kadang dijual eceran lebih kecil (mis. sachet). Kosongkan kalau tidak ada.">
        <input
          name="smallUnit"
          value={smallUnit}
          onChange={(e) => setSmallUnit(e.target.value)}
          placeholder="ex: sachet"
          className={inputClass}
        />
      </Field>
      <Field
        label={`Isi (1 ${mainUnit.trim() || "utama"} = ? ${smallUnit.trim() || "kecil"})`}
        hint="Contoh: 1 box = 12 sachet → isi 12. Kosong/0 kalau tanpa satuan kecil."
      >
        <input name="isi" type="number" min="0" placeholder="ex: 12" className={inputClass} />
      </Field>
      <Field label="Harga retail (Rp)" hint="Default harga jual WA/offline. Bisa diubah saat mencatat penjualan.">
        <CurrencyInput name="priceRetail" placeholder="0" />
      </Field>
      <Field label="Harga grosir (Rp)" hint="Default harga jual ke reseller. Bisa diubah saat mencatat penjualan.">
        <CurrencyInput name="priceGrosir" placeholder="0" />
      </Field>
      <Field label="Grup pembukuan">
        <Select
          name="groupId"
          placeholder="— Tanpa grup —"
          options={[
            { value: "", label: "— Tanpa grup —" },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton
          variant="primary"
          icon={<Plus size={16} />}
          pendingText="Menyimpan…"
          notify="Product ditambahkan"
        >
          Simpan Product
        </SubmitButton>
      </div>
    </form>
  );
}

// chip grup dengan tombol hapus + konfirmasi kecil
function GroupChip({ group, deleteAction }: { group: Group; deleteAction: Action }) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      // popover ~240px; kalau mepet kanan layar, rata-kanan biar tidak terpotong
      setAlignRight(r.left + 240 > window.innerWidth - 8);
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
      <span className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-3 pr-1 text-xs font-medium text-indigo-700">
        <span className="truncate">{group.name}</span>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Hapus grup ${group.name}`}
          className="shrink-0 rounded-full p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-red-600"
        >
          <X size={12} />
        </button>
      </span>
      {open && (
        <div
          className={`absolute top-full z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          <p className="text-xs leading-relaxed text-slate-600 [overflow-wrap:anywhere]">
            Hapus grup <span className="font-semibold text-slate-800">{group.name}</span>? Product-nya
            jadi <span className="font-medium">tanpa grup</span> (tidak ikut terhapus).
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
              <input type="hidden" name="id" value={group.id} />
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

// ---------- Tambah Grup (validasi custom) ----------
export function AddGroupForm({
  groups,
  action,
  deleteAction,
}: {
  groups: Group[];
  action: Action;
  deleteAction: Action;
}) {
  const [error, setError] = useState<string | undefined>();

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      e.preventDefault();
      setError("Nama grup wajib diisi.");
    } else if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      e.preventDefault();
      setError("Grup dengan nama ini sudah ada.");
    } else {
      setError(undefined);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <form action={action} onSubmit={validate} noValidate className="space-y-4">
        <Field label="Nama grup" error={error}>
          <input
            name="name"
            onInput={() => error && setError(undefined)}
            placeholder="ex: Flimty"
            className={`${inputClass} ${error ? inputErrorClass : ""}`}
          />
        </Field>
        <SubmitButton variant="outline" icon={<FolderPlus size={16} />} pendingText="Menyimpan…">
          Tambah Grup
        </SubmitButton>
      </form>
      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pt-1">
        {groups.length ? (
          groups.map((g) => <GroupChip key={g.id} group={g} deleteAction={deleteAction} />)
        ) : (
          <span className="text-xs text-slate-400">Belum ada grup</span>
        )}
      </div>
    </div>
  );
}
