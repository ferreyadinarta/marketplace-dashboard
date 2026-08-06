"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import { type SelectOption } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { splitBase, tiersOf, type UnitInfo } from "@/lib/units";
import {
  BundleComponentList,
  compsToPayload,
  emptyCompRow,
  type CompRow,
} from "@/components/BundleComponentList";

type Action = (formData: FormData) => void | Promise<void>;

// Editor isi bundle untuk product yang SUDAH ada (di panel Edit).
// Product baru yang memang bundle dibuat lewat mode "Bundle" di form Tambah Product.
export function BundleEditor({
  productId,
  initialIsBundle,
  initialComponents,
  productOptions,
  unitOf,
  action,
}: {
  productId: string;
  initialIsBundle: boolean;
  initialComponents: { componentId: string; qty: number }[];
  productOptions: SelectOption[];
  unitOf?: Record<string, UnitInfo>;
  action: Action;
}) {
  const [isBundle, setIsBundle] = useState(initialIsBundle);
  const [rows, setRows] = useState<CompRow[]>(
    initialComponents.length
      ? initialComponents.map((c) => {
          const s = splitBase(Math.max(1, c.qty), tiersOf(unitOf?.[c.componentId]));
          return { componentId: c.componentId, qty: String(s.qty), tier: s.tier };
        })
      : [emptyCompRow()]
  );

  const clean = compsToPayload(rows, unitOf);

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
        modalnya = jumlah HPP isinya. Jumlah isi ditulis dalam satuan product-nya sendiri.
      </p>

      {isBundle && (
        <div className="mt-3">
          <BundleComponentList
            rows={rows}
            onChange={setRows}
            productOptions={productOptions}
            unitOf={unitOf}
          />
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
