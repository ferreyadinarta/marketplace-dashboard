"use client";

import { Plus, X } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui";
import { tiersOf, type UnitInfo } from "@/lib/units";
import { useT } from "@/components/LangProvider";

export type CompRow = { componentId: string; qty: string; tier: string };

export const emptyCompRow = (): CompRow => ({ componentId: "", qty: "1", tier: "base" });

// Ubah baris editor → data yang dikirim ke server: qty SELALU satuan dasar.
export function compsToPayload(rows: CompRow[], unitOf?: Record<string, UnitInfo>) {
  return rows
    .map((r) => {
      const tiers = tiersOf(unitOf?.[r.componentId]);
      const factor = tiers.find((t) => t.key === r.tier)?.factor ?? 1;
      return { componentId: r.componentId, qty: Math.max(1, Math.floor(Number(r.qty) || 0)) * factor };
    })
    .filter((r) => r.componentId && r.qty >= 1);
}

// Daftar "isi bundle": product + jumlah + satuan. Dipakai di form tambah product
// (mode bundle) maupun editor bundle pada product yang sudah ada.
export function BundleComponentList({
  rows,
  onChange,
  productOptions,
  unitOf,
}: {
  rows: CompRow[];
  onChange: (rows: CompRow[]) => void;
  productOptions: SelectOption[];
  unitOf?: Record<string, UnitInfo>;
}) {
  const t = useT();
  const setRow = (i: number, patch: Partial<CompRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // ganti product isi → satuannya beda; kalau tier lama tidak ada, balik ke dasar
  const chooseComponent = (i: number, next: string) => {
    const tiers = tiersOf(unitOf?.[next]);
    const keep = tiers.some((tr) => tr.key === rows[i].tier);
    setRow(i, { componentId: next, tier: keep ? rows[i].tier : "base" });
  };

  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const tiers = tiersOf(unitOf?.[r.componentId]);
        const factor = tiers.find((tr) => tr.key === r.tier)?.factor ?? 1;
        const baseQty = Math.max(1, Math.floor(Number(r.qty) || 0)) * factor;
        const baseUnit = tiers[tiers.length - 1].label;
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={r.componentId}
                onValueChange={(v) => chooseComponent(i, v)}
                placeholder={t("Pilih product isi…", "Choose content product…")}
                options={productOptions}
                searchable
              />
            </div>
            <input
              type="number"
              min="1"
              value={r.qty}
              onChange={(e) => setRow(i, { qty: e.target.value })}
              aria-label={t("Jumlah isi", "Content quantity")}
              className="h-10 w-20 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {r.componentId ? (
              tiers.length > 1 ? (
                <div className="flex h-10 overflow-hidden rounded-lg border border-slate-300 text-xs">
                  {tiers.map((tr) => (
                    <button
                      key={tr.key}
                      type="button"
                      onClick={() => setRow(i, { tier: tr.key })}
                      className={
                        r.tier === tr.key
                          ? "bg-indigo-600 px-2.5 font-medium text-white"
                          : "px-2.5 text-slate-600 hover:bg-slate-50"
                      }
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-500">{baseUnit}</span>
              )
            ) : (
              <span className="text-xs text-slate-300">{t("satuan", "unit")}</span>
            )}
            {factor > 1 && (
              <span className="whitespace-nowrap text-xs text-slate-400">
                = {baseQty} {baseUnit}
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(rows.length === 1 ? rows : rows.filter((_, idx) => idx !== i))}
              disabled={rows.length === 1}
              aria-label={t("Hapus isi", "Remove content")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...rows, emptyCompRow()])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
      >
        <Plus size={15} /> {t("Tambah isi", "Add content")}
      </button>
    </div>
  );
}
