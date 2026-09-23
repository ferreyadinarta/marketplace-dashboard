"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronLeft, Minus, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { tiersOf, type Tier } from "@/lib/units";

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
  const [idx, setIdx] = useState(startIndex);
  const [counts, setCounts] = useState<Record<string, Record<string, string>>>({});
  const [result, setResult] = useState<Record<string, "saved" | "skipped">>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const listToggle = showingAll
    ? dueCount > 0 && dueCount < totalCount
      ? { href: "/stok/hitung", label: `Hanya yang perlu dihitung (${dueCount})` }
      : null
    : dueCount < totalCount
      ? { href: "/stok/hitung?semua=1", label: `Semua product (${totalCount})` }
      : null;

  const header = (
    <div className="flex items-center justify-between gap-3">
      <Link href="/stok" className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
        <ChevronLeft size={18} /> Stok
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
        <p className="py-16 text-center text-sm text-slate-500">Belum ada product untuk dihitung.</p>
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
          <h1 className="mt-4 text-xl font-bold text-slate-900">Selesai</h1>
          <p className="mt-1 text-sm text-slate-500">
            {saved} product tersimpan{skipped > 0 ? `, ${skipped} dilewati` : ""}.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/stok" className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700">
              Kembali ke Stok
            </Link>
            {firstSkipped >= 0 && (
              <button
                type="button"
                onClick={() => setIdx(firstSkipped)}
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Hitung yang dilewati
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
  const filled = tiers.some((t) => (vals[t.key] ?? "").trim() !== "");
  const total = tiers.reduce((sum, t) => sum + Math.max(0, Math.floor(Number(vals[t.key]) || 0)) * t.factor, 0);
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
        window.dispatchEvent(new CustomEvent("app:toast", { detail: `${it.name} tersimpan` }));
        next();
      } catch {
        setError("Gagal menyimpan. Cek koneksi lalu coba lagi.");
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
          <span className="font-semibold text-slate-900">Hitung stok</span>
          <span className="tabular-nums text-slate-500">
            {idx + 1} dari {items.length}
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
          {result[it.productId] === "saved" && <span className="ml-1 font-medium text-emerald-600">· sudah disimpan</span>}
        </p>

        <p className="mt-5 text-sm font-medium text-slate-700">Berapa yang ada di gudang?</p>
        <div className="mt-2 space-y-3">
          {tiers.map((t, ti) => (
            <div key={t.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => step(t.key, -1)}
                aria-label={`Kurangi ${t.label}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 active:bg-slate-100"
              >
                <Minus size={20} />
              </button>
              <input
                value={vals[t.key] ?? ""}
                onChange={(e) => setVal(t.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ti === tiers.length - 1 && filled && !pending) save();
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint={ti === tiers.length - 1 ? "done" : "next"}
                placeholder="0"
                aria-label={`Jumlah ${t.label}`}
                className="h-14 min-w-0 flex-1 rounded-xl border border-slate-300 text-center text-2xl font-bold tabular-nums text-slate-900 placeholder:text-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => step(t.key, 1)}
                aria-label={`Tambah ${t.label}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 active:bg-slate-100"
              >
                <Plus size={20} />
              </button>
              <span className="w-14 shrink-0 text-sm text-slate-500">{t.label}</span>
            </div>
          ))}
        </div>

        {/* hasil: angka sistem baru muncul setelah user mengisi, supaya
            hitungannya tidak ikut-ikutan angka sistem */}
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          {!filled ? (
            <p className="text-slate-400">Isi hitunganmu dulu — angka sistem muncul setelahnya.</p>
          ) : (
            <>
              <p className="text-slate-900">
                Total <strong className="tabular-nums">{total} {baseLabel}</strong>
                {tiers.length > 1 && total > 0 && <span className="text-slate-500"> = {breakdown(total, tiers)}</span>}
              </p>
              {selisih === null ? (
                <p className="mt-1 text-slate-500">Belum pernah dihitung — angka ini jadi stok awal.</p>
              ) : (
                <p className="mt-1 text-slate-500">
                  Menurut sistem {it.current} {baseLabel} ·{" "}
                  {selisih === 0 ? (
                    <span className="font-semibold text-emerald-600">cocok</span>
                  ) : (
                    <span className={`font-semibold ${selisih > 0 ? "text-blue-600" : "text-red-600"}`}>
                      selisih {selisih > 0 ? `+${selisih}` : selisih}
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
            <p>Selisihnya besar. Cek lagi hitungan dan satuannya — apakah yang dihitung {tiers[0].label} atau {baseLabel}?</p>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </div>

      {idx > 0 && (
        <button type="button" onClick={() => setIdx((i) => i - 1)} className="text-sm text-slate-500 hover:text-slate-800">
          Product sebelumnya
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
            Lewati
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!filled || pending}
            className={`h-12 flex-1 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40 ${
              bigDiff ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {pending ? "Menyimpan…" : bigDiff ? "Tetap simpan" : idx === items.length - 1 ? "Simpan & selesai" : "Simpan & lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
