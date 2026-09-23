"use client";

import { useState } from "react";
import { Wand2, Link2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select, type SelectOption as Option } from "@/components/Select";
import { useT } from "@/components/LangProvider";
import type { T } from "@/lib/i18n";

type Action = (formData: FormData) => void | Promise<void>;

function isiOptions(t: T): Option[] {
  return [
    { value: "auto", label: t("isi: tebak dari nama", "contains: guess from name") },
    ...[1, 6, 10, 12, 16, 20, 30].map((n) => ({ value: String(n), label: t(`isi: ${n}`, `contains: ${n}`) })),
  ];
}

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
  const t = useT();
  const [confirm, setConfirm] = useState<null | "suggest" | "product">(null);
  const [productId, setProductId] = useState("");
  const [baseQty, setBaseQty] = useState("auto");

  if (unmappedInFilter === 0) return null;

  const productName = options.find((o) => o.value === productId)?.label ?? "";
  const scopeText = isFiltered
    ? t("hasil filter sekarang", "the current filter results")
    : t("semua SKU yang belum dipetakan", "all unmapped SKUs");

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
        {t("Petakan sekaligus: ", "Bulk map: ")}
        {unmappedInFilter} SKU {isFiltered ? t("di hasil filter", "in the filter results") : t("yang belum dipetakan", "not mapped yet")}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={suggestable === 0}
          onClick={() => setConfirm("suggest")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
          title={suggestable === 0 ? t("Tidak ada saran yang cukup yakin", "No confident suggestion available") : undefined}
        >
          <Wand2 size={15} />
          {t("Terima semua saran", "Accept all suggestions")} ({suggestable})
        </button>

        <span className="text-center text-xs text-slate-400 sm:text-left">{t("atau", "or")}</span>

        <Select
          value={productId}
          onValueChange={setProductId}
          placeholder={t("Pilih product tujuan", "Choose target product")}
          className="w-full sm:w-56"
          options={options}
          searchable
        />

        <Select
          value={baseQty}
          onValueChange={setBaseQty}
          className="w-full sm:w-44"
          options={isiOptions(t)}
        />

        <button
          type="button"
          disabled={!productId}
          onClick={() => setConfirm("product")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-40"
        >
          <Link2 size={15} />
          {t(`Petakan ${unmappedInFilter} ke product ini`, `Map ${unmappedInFilter} to this product`)}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {t(
          "Yang sudah dipetakan tidak diubah. Order lama ikut diperbaiki otomatis, jadi pembukuan & stok langsung menyesuaikan.",
          "Already-mapped rows aren't changed. Old orders are fixed automatically too, so bookkeeping & stock adjust right away."
        )}
      </p>

      {/* konfirmasi: terima semua saran */}
      <ConfirmDialog
        open={confirm === "suggest"}
        onClose={() => setConfirm(null)}
        action={action}
        tone="primary"
        title={t(`Terima ${suggestable} saran otomatis?`, `Accept ${suggestable} automatic suggestions?`)}
        confirmText={t("Terapkan saran", "Apply suggestions")}
        busyText={t("Menerapkan…", "Applying…")}
        message={
          <>
            <p>
              {t(
                `${suggestable} SKU di ${scopeText} akan dipetakan ke product hasil tebakan, lengkap dengan isi per unit dari teks variannya.`,
                `${suggestable} SKUs in ${scopeText} will be mapped to the guessed product, including the qty per unit guessed from the variant text.`
              )}
            </p>
            <p className="mt-2">
              {unmappedInFilter - suggestable > 0
                ? t(
                    `${unmappedInFilter - suggestable} SKU tanpa saran yang cukup yakin dilewati. Petakan manual.`,
                    `${unmappedInFilter - suggestable} SKUs with no confident suggestion are skipped. Map those manually.`
                  )
                : t("Semua SKU di filter ini punya saran.", "All SKUs in this filter have a suggestion.")}{" "}
              {t("Bisa diubah lagi satu per satu setelah ini.", "You can still change each one individually afterward.")}
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
        title={t(`Petakan ${unmappedInFilter} SKU ke satu product?`, `Map ${unmappedInFilter} SKUs to one product?`)}
        confirmText={t("Petakan semua", "Map all")}
        busyText={t("Memetakan…", "Mapping…")}
        message={
          <>
            <p>
              {t("Semua SKU belum dipetakan di ", "All unmapped SKUs in ")}
              {scopeText}
              {t(" akan diarahkan ke ", " will be pointed to ")}
              <strong className="text-slate-700">{productName}</strong>.
            </p>
            <p className="mt-2">
              {t("Isi per unit: ", "Qty per unit: ")}
              <strong className="text-slate-700">
                {baseQty === "auto"
                  ? t("ditebak dari nama tiap SKU", "guessed from each SKU's name")
                  : t(`${baseQty} satuan dasar`, `${baseQty} base units`)}
              </strong>
              . {t("Saring dulu pakai kotak Cari kalau belum yakin cakupannya.", "Filter first with the Search box if you're not sure about the scope.")}
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
