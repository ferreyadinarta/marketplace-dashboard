"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Download, RotateCcw } from "lucide-react";
import { Select } from "@/components/ui";
import DateRangePicker from "@/components/DateRangePicker";
import { useT } from "@/components/LangProvider";

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
  const t = useT();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // ganti marketplace → toko yang terpilih bisa jadi bukan milik marketplace
    // itu lagi; buang saja daripada menampilkan hasil kosong tanpa sebab jelas
    if (key === "marketplace") {
      const cur = params.get("storeId");
      const stillValid = stores.some((s) => s.id === cur && (!value || s.marketplace === value));
      if (!stillValid) next.delete("storeId");
    }
    router.push(`/pembukuan?${next.toString()}`, { scroll: false });
  }

  // daftar toko ikut filter marketplace: pilih "Grosir / Reseller" → cuma toko
  // grosir yang muncul
  const marketplace = params.get("marketplace") ?? "";
  const storeOptions = marketplace ? stores.filter((s) => s.marketplace === marketplace) : stores;

  // Default halaman = semua data. Export ikut itu (tanpa from/to) kecuali
  // user pilih rentang. all=1 juga berarti semua data.
  const isAll =
    params.get("all") === "1" || (!params.get("from") && !params.get("to"));
  const exportParams = new URLSearchParams(params.toString());
  if (!isAll) {
    if (!exportParams.get("from")) exportParams.set("from", initialFrom);
    if (!exportParams.get("to")) exportParams.set("to", initialTo);
  }
  const qs = exportParams.toString();
  const hasFilter = params.toString().length > 0;

  return (
    <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
      <label className="col-span-2 block sm:w-auto">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("Rentang tanggal", "Date range")}</span>
        <DateRangePicker initialFrom={initialFrom} initialTo={initialTo} defaultAll />
      </label>
      <label className="block min-w-0 sm:w-auto">
        <span className="mb-1 block text-xs font-medium text-slate-600">Marketplace</span>
        <Select
          className="w-full sm:w-auto sm:min-w-40"
          value={params.get("marketplace") ?? ""}
          onValueChange={(v) => update("marketplace", v)}
          options={[
            { value: "", label: t("Semua", "All") },
            { value: "SHOPEE", label: "Shopee" },
            { value: "TIKTOK", label: "TikTok Shop" },
            { value: "TOKOPEDIA", label: "Tokopedia" },
            { value: "WA", label: t("WhatsApp / Offline", "WhatsApp / Offline") },
            { value: "KONSINYASI", label: t("Grosir / Reseller", "Wholesale / Reseller") },
          ]}
        />
      </label>
      <label className="block min-w-0 sm:w-auto">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("Toko", "Store")}</span>
        <Select
          className="w-full sm:w-auto sm:min-w-44"
          value={params.get("storeId") ?? ""}
          onValueChange={(v) => update("storeId", v)}
          options={[
            { value: "", label: t("Semua", "All") },
            ...storeOptions.map((s) => ({ value: s.id, label: s.name })),
          ]}
          disabled={storeOptions.length === 0}
        />
      </label>
      <label className="block min-w-0 sm:w-auto">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("Grup / Brand", "Group / Brand")}</span>
        <Select
          className="w-full sm:w-auto sm:min-w-44"
          value={params.get("groupId") ?? ""}
          onValueChange={(v) => update("groupId", v)}
          options={[
            { value: "", label: t("Semua grup", "All groups") },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
            { value: "__none__", label: t("Tanpa Grup", "No group") }, // bucket product tanpa grup
          ]}
        />
      </label>

      {hasFilter && (
        <button
          onClick={() => router.push("/pembukuan", { scroll: false })}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:w-auto"
        >
          <RotateCcw size={15} /> {t("Reset", "Reset")}
        </button>
      )}

      <a
        href={`/api/export?${qs}`}
        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 sm:ml-auto sm:w-auto"
      >
        <Download size={16} /> {t("Export Excel", "Export to Excel")}
      </a>
    </div>
  );
}
