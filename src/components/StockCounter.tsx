"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronLeft, Minus, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { tiersOf, type Tier } from "@/lib/units";
import { useT } from "@/components/LangProvider";

type Item = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  packUnit: string;
  packSize: number;
  koliUnit: string;
  koliSize: number;
  current: number; // stok sistem, satuan dasar
  known: boolean; // false = belum pernah opname → hitungan jadi stok awal
  lastLabel: string;
};

type Action = (formData: FormData) => Promise<void>;

// selisih > 50% dari stok sistem → kemungkinan salah satuan / salah ketik
const BIG_DIFF = 0.5;

// "100 sachet" → "8 box + 4 sachet" (tanpa pecahan)
function breakdown(base: number, tiers: Tier[]): string {
  if (tiers.length === 1) return `${base} ${tiers[0].label}`;
  let rest = base;
  const parts: string[] = [];
  for (const t of tiers) {
    const q = Math.floor(rest / t.factor);
    rest -= q * t.factor;
    if (q > 0) parts.push(`${q} ${t.label}`);
  }
  return parts.join(" + ") || `0 ${tiers[tiers.length - 1].label}`;
}

// Hitung stok satu product per layar — dibuat untuk dipakai sambil berdiri di
// gudang pakai HP. Tiap tingkat satuan (koli/box/sachet) punya kolom sendiri,
// jadi tidak ada toggle satuan yang bisa salah pencet.
export function StockCounter({
  items,
  startIndex,
  showingAll,
  dueCount,
  totalCount,
  action,
}: {
  items: Item[];
  startIndex: number;
  showingAll: boolean;
  dueCount: number;
  totalCount: number;
  action: Action;
}) {
  const t = useT();
  const [idx, setIdx] = useState(startIndex);
  const [counts, setCounts] = useState<Record<string, Record<string, string>>>({});
  const [result, setResult] = useState<Record<string, "saved" | "skipped">>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const listToggle = showingAll
    ? dueCount > 0 && dueCount < totalCount
      ? { href: "/stok/hitung", label: t(`Hanya yang perlu dihitung (${dueCount})`, `Only what needs counting (${dueCount})`) }
      : null
    : dueCount < totalCount
      ? { href: "/stok/hitung?semua=1", label: t(`Semua product (${totalCount})`, `All products (${totalCount})`) }
      : null;

  const header = (
    <div className="flex items-center justify-between gap-3">
      <Link href="/stok" className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
        <ChevronLeft size={18} /> {t("Stok", "Stock")}
      </Link>
      {listToggle && (
        <Link href={listToggle.href} className="text-sm font-medium text-indigo-600 hover:underline">
          {listToggle.label}
        </Link>
      )}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        {header}
        <p className="py-16 text-center text-sm text-slate-500">{t("Belum ada product untuk dihitung.", "No products to count yet.")}</p>
      </div>
    );
  }

  // ---------- selesai ----------
  if (idx >= items.length) {
    const saved = Object.values(result).filter((r) => r === "saved").length;
    const skipped = Object.values(result).filter((r) => r === "skipped").length;
    const firstSkipped = items.findIndex((i) => result[i.productId] === "skipped");
    return (
      <div className="mx-auto max-w-md space-y-6">
        {header}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">{t("Selesai", "Done")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {skipped > 0
              ? t(`${saved} product tersimpan, ${skipped} dilewati.`, `${saved} product${saved === 1 ? "" : "s"} saved, ${skipped} skipped.`)
              : t(`${saved} product tersimpan.`, `${saved} product${saved === 1 ? "" : "s"} saved.`)}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/stok" className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700">
              {t("Kembali ke Stok", "Back to Stock")}
            </Link>
            {firstSkipped >= 0 && (
              <button
                type="button"
                onClick={() => setIdx(firstSkipped)}
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("Hitung yang dilewati", "Count what was skipped")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- satu product ----------
  const it = items[idx];
  const tiers = tiersOf(it);
  const vals = counts[it.productId] ?? {};
  const filled = tiers.some((tier) => (vals[tier.key] ?? "").trim() !== "");
  const total = tiers.reduce((sum, tier) => sum + Math.max(0, Math.floor(Number(vals[tier.key]) || 0)) * tier.factor, 0);
  const selisih = it.known ? total - it.current : null;
  const bigDiff = filled && selisih !== null && it.current > 0 && Math.abs(selisih) / it.current > BIG_DIFF;
  const baseLabel = tiers[tiers.length - 1].label;

  const setVal = (key: string, v: string) =>
    setCounts((c) => ({ ...c, [it.productId]: { ...(c[it.productId] ?? {}), [key]: v.replace(/[^0-9]/g, "") } }));
  const step = (key: string, d: number) => setVal(key, String(Math.max(0, (Number(vals[key]) || 0) + d)));

  const next = () => {
    setError("");
    setIdx((i) => i + 1);
    window.scrollTo({ top: 0 });
  };

  const save = () => {
    const fd = new FormData();
    fd.set("productId", it.productId);
    fd.set("countedQty", String(total));
    fd.set("unit", "base"); // total sudah dikonversi ke satuan dasar di sini
    startTransition(async () => {
      try {
        await action(fd);
        setResult((r) => ({ ...r, [it.productId]: "saved" }));
        window.dispatchEvent(new CustomEvent("app:toast", { detail: t(`${it.name} tersimpan`, `${it.name} saved`) }));
        next();
      } catch {
        setError(t("Gagal menyimpan. Cek koneksi lalu coba lagi.", "Failed to save. Check your connection and try again."));
      }
    });
  };

  const skip = () => {
    setResult((r) => (r[it.productId] === "saved" ? r : { ...r, [it.productId]: "skipped" }));
    next();
  };

  return (
    <div className="mx-auto max-w-md space-y-5 pb-28">
      {header}

      {/* progres */}
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-slate-900">{t("Hitung stok", "Count stock")}</span>
          <span className="tabular-nums text-slate-500">
            {t(`${idx + 1} dari ${items.length}`, `${idx + 1} of ${items.length}`)}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(idx / items.length) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold leading-snug text-slate-900">{it.name}</h1>
        <p className="font-mono text-xs text-slate-400">{it.sku}</p>
        <p className="mt-1 text-xs text-slate-500">
          {it.lastLabel}
          {result[it.productId] === "saved" && <span className="ml-1 font-medium text-emerald-600">· {t("sudah disimpan", "already saved")}</span>}
        </p>

        <p className="mt-5 text-sm font-medium text-slate-700">{t("Berapa yang ada di gudang?", "How much is in the warehouse?")}</p>
        <div className="mt-2 space-y-3">
          {tiers.map((tier, ti) => (
            <div key={tier.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => step(tier.key, -1)}
                aria-label={`${t("Kurangi", "Decrease")} ${tier.label}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 active:bg-slate-100"
              >
                <Minus size={20} />
              </button>
              <input
                value={vals[tier.key] ?? ""}
                onChange={(e) => setVal(tier.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ti === tiers.length - 1 && filled && !pending) save();
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint={ti === tiers.length - 1 ? "done" : "next"}
                placeholder="0"
                aria-label={`${t("Jumlah", "Quantity")} ${tier.label}`}
                className="h-14 min-w-0 flex-1 rounded-xl border border-slate-300 text-center text-2xl font-bold tabular-nums text-slate-900 placeholder:text-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => step(tier.key, 1)}
                aria-label={`${t("Tambah", "Add")} ${tier.label}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 active:bg-slate-100"
              >
                <Plus size={20} />
              </button>
              <span className="w-14 shrink-0 text-sm text-slate-500">{tier.label}</span>
            </div>
          ))}
        </div>

        {/* hasil: angka sistem baru muncul setelah user mengisi, supaya
            hitungannya tidak ikut-ikutan angka sistem */}
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          {!filled ? (
            <p className="text-slate-400">{t("Isi hitunganmu dulu, angka sistem muncul setelahnya.", "Enter your count first, the system number will show up after.")}</p>
          ) : (
            <>
              <p className="text-slate-900">
                {t("Total", "Total")} <strong className="tabular-nums">{total} {baseLabel}</strong>
                {tiers.length > 1 && total > 0 && <span className="text-slate-500"> = {breakdown(total, tiers)}</span>}
              </p>
              {selisih === null ? (
                <p className="mt-1 text-slate-500">{t("Belum pernah dihitung. Angka ini jadi stok awal.", "Never counted before. This number becomes the opening stock.")}</p>
              ) : (
                <p className="mt-1 text-slate-500">
                  {t("Menurut sistem", "According to the system")} {it.current} {baseLabel} ·{" "}
                  {selisih === 0 ? (
                    <span className="font-semibold text-emerald-600">{t("cocok", "match")}</span>
                  ) : (
                    <span className={`font-semibold ${selisih > 0 ? "text-blue-600" : "text-red-600"}`}>
                      {t("selisih", "difference")} {selisih > 0 ? `+${selisih}` : selisih}
                    </span>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        {bigDiff && (
          <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <p>
              {t(
                `Selisihnya besar. Cek lagi hitungan dan satuannya: apakah yang dihitung ${tiers[0].label} atau ${baseLabel}?`,
                `The difference is large. Double-check your count and unit: was it counted in ${tiers[0].label} or ${baseLabel}?`
              )}
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </div>

      {idx > 0 && (
        <button type="button" onClick={() => setIdx((i) => i - 1)} className="text-sm text-slate-500 hover:text-slate-800">
          {t("Product sebelumnya", "Previous product")}
        </button>
      )}

      {/* aksi — menempel di bawah layar supaya selalu terjangkau jempol */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            onClick={skip}
            disabled={pending}
            className="h-12 rounded-xl border border-slate-300 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t("Lewati", "Skip")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!filled || pending}
            className={`h-12 flex-1 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40 ${
              bigDiff ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {pending
              ? t("Menyimpan…", "Saving…")
              : bigDiff
                ? t("Tetap simpan", "Save anyway")
                : idx === items.length - 1
                  ? t("Simpan & selesai", "Save & finish")
                  : t("Simpan & lanjut", "Save & continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
