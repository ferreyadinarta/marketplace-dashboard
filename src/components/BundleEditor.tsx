"use client";

import { useState } from "react";
import { Plus, X, Boxes } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type Action = (formData: FormData) => void | Promise<void>;
type Row = { componentId: string; qty: string };

// Editor bundle: tandai product sebagai bundle + atur isinya (product × qty).
// Bundle tidak di-stok/opname sendiri; saat terjual, stok tiap isinya berkurang.
export function BundleEditor({
  productId,
  initialIsBundle,
  initialComponents,
  productOptions,
  action,
}: {
  productId: string;
  initialIsBundle: boolean;
  initialComponents: { componentId: string; qty: number }[];
  productOptions: SelectOption[];
  action: Action;
}) {
  const [isBundle, setIsBundle] = useState(initialIsBundle);
  const [rows, setRows] = useState<Row[]>(
    initialComponents.length
      ? initialComponents.map((c) => ({ componentId: c.componentId, qty: String(c.qty) }))
      : [{ componentId: "", qty: "1" }]
  );

  const setRow = (i: number, key: keyof Row, val: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addRow = () => setRows((prev) => [...prev, { componentId: "", qty: "1" }]);
  const removeRow = (i: number) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const clean = rows
    .map((r) => ({ componentId: r.componentId, qty: Math.max(1, Math.floor(Number(r.qty) || 0)) }))
    .filter((r) => r.componentId && r.qty >= 1);

  return (
    <form action={action} className="mt-4 border-t border-slate-100 pt-4">
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="isBundle" value={isBundle ? "true" : "false"} />
      <input type="hidden" name="components" value={JSON.stringify(clean)} />

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={isBundle}
          onChange={(e) => setIsBundle(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <Boxes size={15} className="text-slate-400" /> Product ini bundle (isi gabungan product lain)
      </label>
      <p className="mt-1 text-xs text-slate-400">
        Bundle tidak dihitung stok/opname sendiri. Saat terjual, stok tiap isinya otomatis berkurang &amp;
        modalnya = jumlah HPP isinya.
      </p>

      {isBundle && (
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  value={r.componentId}
                  onValueChange={(v) => setRow(i, "componentId", v)}
                  placeholder="Pilih product isi…"
                  options={productOptions}
                  searchable
                />
              </div>
              <input
                type="number"
                min="1"
                value={r.qty}
                onChange={(e) => setRow(i, "qty", e.target.value)}
                aria-label="Jumlah isi"
                className="h-10 w-20 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                aria-label="Hapus isi"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Plus size={15} /> Tambah isi
          </button>
        </div>
      )}

      <div className="mt-4">
        <SubmitButton variant="outline" pendingText="Menyimpan…" notify="Bundle tersimpan">
          Simpan Bundle
        </SubmitButton>
      </div>
    </form>
  );
}
