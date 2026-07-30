"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, Settings2, ChevronDown } from "lucide-react";
import { Field, inputClass, inputErrorClass, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type Action = (formData: FormData) => void | Promise<void>;

// Bagian pengaturan API yang bisa dilipat. Default tertutup supaya tidak
// membingungkan user yang cuma perlu atur nama & marketplace.
export function AdvancedApiSection({
  connected,
  children,
}: {
  connected: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-sm text-slate-500 hover:text-slate-700"
      >
        <span className="flex items-center gap-2">
          <Settings2 size={15} />
          Pengaturan API (untuk koneksi otomatis)
          {!connected && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              opsional
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-3">
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
            Bagian ini untuk menghubungkan toko ke API marketplace (diisi oleh
            yang mengatur teknis). Cukup kosongkan kalau belum punya kredensial,
            nama & marketplace tetap tersimpan.
          </p>
          {children}
        </div>
      )}
    </div>
  );
}

export function AddStoreForm({ action }: { action: Action }) {
  const [error, setError] = useState<string | undefined>();

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      e.preventDefault();
      setError("Nama toko wajib diisi.");
    } else {
      setError(undefined);
    }
  }

  return (
    <form
      action={action}
      onSubmit={validate}
      noValidate
      className="flex flex-wrap items-end gap-4 px-5 pb-9 pt-5"
    >
      <Field label="Nama toko">
        {/* error diposisikan absolute supaya munculnya tidak menggeser baris (input & tombol tetap sejajar) */}
        <div className="relative w-full sm:w-80">
          <input
            name="name"
            onInput={() => error && setError(undefined)}
            placeholder="ex: Luxe Supplement Store — Shopee"
            className={`${inputClass} w-full ${error ? inputErrorClass : ""}`}
          />
          {error && (
            <span className="absolute left-0 top-full mt-1 block text-xs font-medium text-red-500">
              {error}
            </span>
          )}
        </div>
      </Field>
      <Field label="Marketplace">
        <Select
          name="marketplace"
          defaultValue="SHOPEE"
          className="min-w-44"
          options={[
            { value: "SHOPEE", label: "Shopee" },
            { value: "TIKTOK", label: "TikTok Shop" },
            { value: "TOKOPEDIA", label: "Tokopedia" },
          ]}
        />
      </Field>
      <SubmitButton
        variant="primary"
        icon={<Plus size={16} />}
        pendingText="Menyimpan…"
      >
        Tambah Toko
      </SubmitButton>
    </form>
  );
}
