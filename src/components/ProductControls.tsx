"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

// ---------- Delete (trash icon + dialog konfirmasi) ----------
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

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        action={action}
        id={id}
        title="Hapus product ini?"
        message={
          <>
            <span className="font-medium text-slate-700">{name}</span> akan dihapus permanen dan tidak
            bisa dikembalikan.
          </>
        }
        confirmIcon={<Trash2 size={15} />}
      />
    </>
  );
}
