"use client";

import { useMemo, useState } from "react";
import { Trash2, ChevronDown, Search, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Collapse } from "@/components/Collapse";
import { useT } from "@/components/LangProvider";

type Action = (formData: FormData) => void | Promise<void>;

export type CleanupRow = {
  id: string;
  name: string;
  sku: string;
  hpp: number;
  orderItems: number; // berapa baris order memakai product ini
  stockRecords: number; // opname + barang masuk (riwayat yang IKUT terhapus)
};

// Hapus banyak product sekaligus — untuk membersihkan product sampah hasil import
// lama (dulu import membuat 1 product per varian marketplace dengan nama panjang).
export function BulkDeleteProducts({ products, action }: { products: CleanupRow[]; action: Action }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [onlyNoHpp, setOnlyNoHpp] = useState(true);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyNoHpp && p.hpp > 0) return false;
      if (needle && !`${p.name} ${p.sku}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [products, q, onlyNoHpp]);

  const ids = Object.keys(sel).filter((k) => sel[k]);
  const selected = products.filter((p) => sel[p.id]);
  const losingHistory = selected.filter((p) => p.stockRecords > 0).length;
  const losingLinks = selected.reduce((a, p) => a + p.orderItems, 0);

  const allShownPicked = shown.length > 0 && shown.every((p) => sel[p.id]);
  const toggleAllShown = () =>
    setSel((prev) => {
      const next = { ...prev };
      for (const p of shown) next[p.id] = !allShownPicked;
      return next;
    });

  if (products.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <Trash2 size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{t("Hapus Product Massal", "Bulk delete products")}</span>
          <span className="block text-xs text-slate-500">
            {t(
              "Bersihkan product sampah (mis. hasil import lama yang namanya panjang & HPP-nya masih 0).",
              "Clean up junk products (e.g. old imports with long names and COGS still at 0)."
            )}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <Collapse open={open}>
        <div className="border-t border-slate-100 p-5">
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
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyNoHpp}
                onChange={(e) => setOnlyNoHpp(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              {t("Hanya yang HPP-nya 0", "Only where COGS is 0")}
            </label>
            <button
              type="button"
              onClick={toggleAllShown}
              disabled={shown.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              {allShownPicked ? t("Batal pilih semua", "Deselect all") : t(`Pilih semua (${shown.length})`, `Select all (${shown.length})`)}
            </button>
          </div>

          <div className="max-h-[24rem] space-y-1 overflow-y-auto pr-1">
            {shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t("Tidak ada product yang cocok.", "No matching products.")}</p>
            ) : (
              shown.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={!!sel[p.id]}
                    onChange={(e) => setSel((s) => ({ ...s, [p.id]: e.target.checked }))}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-800">{p.name}</span>
                    <span className="block truncate font-mono text-[11px] text-slate-400">{p.sku}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-slate-400">
                    {p.orderItems > 0 && <span className="block">{t(`${p.orderItems} order`, `${p.orderItems} order${p.orderItems === 1 ? "" : "s"}`)}</span>}
                    {p.stockRecords > 0 && (
                      <span className="block font-medium text-amber-600">{t(`${p.stockRecords} data stok`, `${p.stockRecords} stock record${p.stockRecords === 1 ? "" : "s"}`)}</span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">{t(`${ids.length} product dipilih`, `${ids.length} product${ids.length === 1 ? "" : "s"} selected`)}</span>
            <button
              type="button"
              disabled={ids.length === 0}
              onClick={() => setConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              <Trash2 size={15} /> {t("Hapus", "Delete")} {ids.length > 0 ? `(${ids.length})` : ""}
            </button>
          </div>

          <ConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            action={action}
            title={t(`Hapus ${ids.length} product?`, `Delete ${ids.length} product${ids.length === 1 ? "" : "s"}?`)}
            message={
              <>
                {t("Product yang dipilih akan dihapus permanen.", "The selected products will be permanently deleted.")}
                {losingLinks > 0 && (
                  <>
                    {" "}
                    <span className="font-medium text-slate-700">{t(`${losingLinks} baris order`, `${losingLinks} order line${losingLinks === 1 ? "" : "s"}`)}</span>{" "}
                    {t("tetap ada tapi jadi belum dipetakan (bisa dipetakan ulang di Mapping SKU).", "will remain but become unmapped (can be re-mapped in SKU Mapping).")}
                  </>
                )}
                {losingHistory > 0 && (
                  <span className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-amber-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      <b>{t(`${losingHistory} product`, `${losingHistory} product${losingHistory === 1 ? "" : "s"}`)}</b>{" "}
                      {t(
                        "punya riwayat opname/barang masuk. Riwayat itu ikut terhapus dan tidak bisa dikembalikan.",
                        "have stock count/restock history. That history will be deleted too and cannot be recovered."
                      )}
                    </span>
                  </span>
                )}
              </>
            }
            confirmText={t("Hapus", "Delete")}
            extraFields={<input type="hidden" name="ids" value={JSON.stringify(ids)} />}
          />
        </div>
      </Collapse>
    </div>
  );
}
