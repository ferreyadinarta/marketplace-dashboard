"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Download, RotateCcw } from "lucide-react";
import { Select } from "@/components/ui";
import DateRangePicker from "@/components/DateRangePicker";

type Store = { id: string; name: string; marketplace: string };
type Group = { id: string; name: string };

export default function PembukuanFilter({
  stores,
  groups,
  initialFrom,
  initialTo,
}: {
  stores: Store[];
  groups: Group[];
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/pembukuan?${next.toString()}`);
  }

  // export ikut rentang efektif (default bulan ini; atau semua data bila all=1)
  const isAll = params.get("all") === "1";
  const exportParams = new URLSearchParams(params.toString());
  if (!isAll) {
    if (!exportParams.get("from")) exportParams.set("from", initialFrom);
    if (!exportParams.get("to")) exportParams.set("to", initialTo);
  }
  const qs = exportParams.toString();
  const hasFilter = params.toString().length > 0;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Rentang tanggal</span>
        <DateRangePicker initialFrom={initialFrom} initialTo={initialTo} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Marketplace</span>
        <Select
          className="min-w-40"
          value={params.get("marketplace") ?? ""}
          onValueChange={(v) => update("marketplace", v)}
          options={[
            { value: "", label: "Semua" },
            { value: "SHOPEE", label: "Shopee" },
            { value: "TIKTOK", label: "TikTok Shop" },
            { value: "TOKOPEDIA", label: "Tokopedia" },
          ]}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Toko</span>
        <Select
          className="min-w-44"
          value={params.get("storeId") ?? ""}
          onValueChange={(v) => update("storeId", v)}
          options={[{ value: "", label: "Semua" }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Grup / Brand</span>
        <Select
          className="min-w-44"
          value={params.get("groupId") ?? ""}
          onValueChange={(v) => update("groupId", v)}
          options={[{ value: "", label: "Semua grup" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
        />
      </label>

      {hasFilter && (
        <button
          onClick={() => router.push("/pembukuan")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw size={15} /> Reset
        </button>
      )}

      <a
        href={`/api/export?${qs}`}
        className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
      >
        <Download size={16} /> Export Excel
      </a>
    </div>
  );
}
