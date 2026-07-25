"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Trash2, X, AlertTriangle } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";

// ---------- Search (nama / SKU) ----------
export function ProductSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(defaultValue);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page"); // reset ke halaman 1 saat cari
      router.push(`/master/product?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari nama atau SKU…"
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-64"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Bersihkan"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ---------- Delete (trash icon + konfirmasi inline) ----------
export function DeleteProductButton({
  id,
  name,
  action,
}: {
  id: string;
  name: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // kunci scroll body saat modal terbuka
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Hapus ${name}`}
        title="Hapus product"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={16} />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden />
            <div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">Hapus product ini?</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    <span className="font-medium text-slate-700">{name}</span> akan dihapus permanen dan tidak
                    bisa dikembalikan.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <form action={action}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton variant="danger" icon={<Trash2 size={15} />} pendingText="Menghapus…">
                    Hapus
                  </SubmitButton>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
