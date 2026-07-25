"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Store = { id: string; name: string; marketplace: string };

export default function PembukuanFilter({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/pembukuan?${next.toString()}`);
  }

  const qs = params.toString();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-500">Dari tanggal</label>
        <input
          type="date"
          defaultValue={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
          className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">Sampai tanggal</label>
        <input
          type="date"
          defaultValue={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
          className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">Marketplace</label>
        <select
          defaultValue={params.get("marketplace") ?? ""}
          onChange={(e) => update("marketplace", e.target.value)}
          className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Semua</option>
          <option value="SHOPEE">Shopee</option>
          <option value="TIKTOK">TikTok Shop</option>
          <option value="TOKOPEDIA">Tokopedia</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">Toko</label>
        <select
          defaultValue={params.get("storeId") ?? ""}
          onChange={(e) => update("storeId", e.target.value)}
          className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Semua</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <a
        href={`/api/export?${qs}`}
        className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Export ke Excel
      </a>
    </div>
  );
}
