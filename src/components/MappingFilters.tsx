"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, RotateCcw } from "lucide-react";
import { Select } from "@/components/ui";

type Store = { id: string; name: string };

export function MappingFilters({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // balik ke halaman 1 tiap ganti filter
    router.push(`/master/mapping?${next.toString()}`);
  }

  // search (debounce)
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setParam("q", q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilter =
    !!params.get("q") || !!params.get("status") || !!params.get("marketplace") || !!params.get("storeId");

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Cari SKU / nama</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-56"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
              aria-label="Bersihkan"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
        <Select
          className="min-w-44"
          value={params.get("status") ?? ""}
          onValueChange={(v) => setParam("status", v)}
          options={[
            { value: "", label: "Semua status" },
            { value: "unmapped", label: "Belum dipetakan" },
            { value: "mapped", label: "Sudah dipetakan" },
          ]}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Marketplace</label>
        <Select
          className="min-w-40"
          value={params.get("marketplace") ?? ""}
          onValueChange={(v) => setParam("marketplace", v)}
          options={[
            { value: "", label: "Semua" },
            { value: "SHOPEE", label: "Shopee" },
            { value: "TIKTOK", label: "TikTok Shop" },
            { value: "TOKOPEDIA", label: "Tokopedia" },
          ]}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Toko</label>
        <Select
          className="min-w-44"
          value={params.get("storeId") ?? ""}
          onValueChange={(v) => setParam("storeId", v)}
          options={[{ value: "", label: "Semua toko" }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </div>

      {hasFilter && (
        <button
          onClick={() => router.push("/master/mapping")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw size={15} /> Reset
        </button>
      )}
    </div>
  );
}
