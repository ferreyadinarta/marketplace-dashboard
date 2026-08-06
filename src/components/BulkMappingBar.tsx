"use client";

import { useState } from "react";
import { Wand2, Link2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Action = (formData: FormData) => void | Promise<void>;
type Option = { value: string; label: string };

// Petakan banyak SKU sekaligus. Dua jalur, dua-duanya cuma menyentuh baris yang
// SEDANG TERSARING dan BELUM dipetakan:
//  1. "Terima semua saran" — pakai tebakan otomatis per baris (paling cepat)
//  2. "Petakan semua ke …" — semua diarahkan ke satu product (untuk varian
//     satu product yang judulnya beda-beda, mis. hasil filter "FLIMEAL")
// Keduanya lewat konfirmasi dulu karena sekali klik bisa mengubah ribuan baris.
export function BulkMappingBar({
  action,
  unmappedInFilter,
  suggestable,
  options,
  filters,
  isFiltered,
}: {
  action: Action;
  unmappedInFilter: number;
  suggestable: number;
  options: Option[]; // product internal (tanpa opsi kosong)
  filters: { q: string; marketplace: string; storeId: string };
  isFiltered: boolean;
}) {
  const [confirm, setConfirm] = useState<null | "suggest" | "product">(null);
  const [productId, setProductId] = useState("");
  const [baseQty, setBaseQty] = useState("auto");

  if (unmappedInFilter === 0) return null;

  const productName = options.find((o) => o.value === productId)?.label ?? "";
  const scopeText = isFiltered ? "hasil filter sekarang" : "semua SKU yang belum dipetakan";

  const hidden = (
    <>
      <input type="hidden" name="q" value={filters.q} />
      <input type="hidden" name="marketplace" value={filters.marketplace} />
      <input type="hidden" name="storeId" value={filters.storeId} />
    </>
  );

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
      <p className="text-sm font-medium text-indigo-900">
        Petakan massal — {unmappedInFilter} SKU belum dipetakan di {scopeText}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={suggestable === 0}
          onClick={() => setConfirm("suggest")}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
          title={suggestable === 0 ? "Tidak ada saran yang cukup yakin" : undefined}
        >
          <Wand2 size={15} />
          Terima semua saran ({suggestable})
        </button>

        <span className="text-xs text-slate-400">atau</span>

        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          aria-label="Product internal tujuan"
          className="h-9 max-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">— Pilih product tujuan —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={baseQty}
          onChange={(e) => setBaseQty(e.target.value)}
          aria-label="Isi per unit"
          title="Berapa satuan dasar untuk 1 unit yang dijual"
          className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="auto">isi: tebak dari nama</option>
          <option value="1">isi: 1</option>
          <option value="6">isi: 6</option>
          <option value="10">isi: 10</option>
          <option value="12">isi: 12</option>
          <option value="16">isi: 16</option>
          <option value="20">isi: 20</option>
          <option value="30">isi: 30</option>
        </select>

        <button
          type="button"
          disabled={!productId}
          onClick={() => setConfirm("product")}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-40"
        >
          <Link2 size={15} />
          Petakan {unmappedInFilter} ke product ini
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Yang sudah dipetakan tidak diubah. Order lama ikut diperbaiki otomatis, jadi pembukuan & stok langsung
        menyesuaikan.
      </p>

      {/* konfirmasi: terima semua saran */}
      <ConfirmDialog
        open={confirm === "suggest"}
        onClose={() => setConfirm(null)}
        action={action}
        tone="primary"
        title={`Terima ${suggestable} saran otomatis?`}
        confirmText="Terapkan saran"
        busyText="Menerapkan…"
        message={
          <>
            <p>
              {suggestable} SKU di {scopeText} akan dipetakan ke product hasil tebakan, lengkap dengan isi per
              unit dari teks variannya.
            </p>
            <p className="mt-2">
              {unmappedInFilter - suggestable > 0
                ? `${unmappedInFilter - suggestable} SKU tanpa saran yang cukup yakin dilewati — petakan manual.`
                : "Semua SKU di filter ini punya saran."}{" "}
              Bisa diubah lagi satu per satu setelah ini.
            </p>
          </>
        }
        extraFields={
          <>
            {hidden}
            <input type="hidden" name="mode" value="suggest" />
          </>
        }
      />

      {/* konfirmasi: semua ke satu product */}
      <ConfirmDialog
        open={confirm === "product"}
        onClose={() => setConfirm(null)}
        action={action}
        tone="primary"
        title={`Petakan ${unmappedInFilter} SKU ke satu product?`}
        confirmText="Petakan semua"
        busyText="Memetakan…"
        message={
          <>
            <p>
              Semua SKU belum dipetakan di {scopeText} akan diarahkan ke{" "}
              <strong className="text-slate-700">{productName}</strong>.
            </p>
            <p className="mt-2">
              Isi per unit:{" "}
              <strong className="text-slate-700">
                {baseQty === "auto" ? "ditebak dari nama tiap SKU" : `${baseQty} satuan dasar`}
              </strong>
              . Saring dulu pakai kotak Cari kalau belum yakin cakupannya.
            </p>
          </>
        }
        extraFields={
          <>
            {hidden}
            <input type="hidden" name="mode" value="product" />
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="baseQty" value={baseQty} />
          </>
        }
      />
    </div>
  );
}
