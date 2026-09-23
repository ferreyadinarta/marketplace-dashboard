"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, Settings2, ChevronDown } from "lucide-react";
import { Field, inputClass, inputErrorClass, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Collapse } from "@/components/Collapse";
import { useT } from "@/components/LangProvider";

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
  const t = useT();
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-sm text-slate-500 hover:text-slate-700"
      >
        <span className="flex items-center gap-2">
          <Settings2 size={15} />
          {t("Pengaturan API (untuk koneksi otomatis)", "API Settings (for automatic connection)")}
          {!connected && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              {t("opsional", "optional")}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <Collapse open={open}>
        <div className="mt-3">
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
            {t(
              "Bagian ini untuk menghubungkan toko ke API marketplace (diisi oleh yang mengatur teknis). Cukup kosongkan kalau belum punya kredensial, nama & marketplace tetap tersimpan.",
              "This section connects the store to the marketplace API (filled in by whoever handles the technical setup). Just leave it blank if you don't have credentials yet, the name & marketplace are still saved."
            )}
          </p>
          {children}
        </div>
      </Collapse>
    </div>
  );
}

export function AddStoreForm({ action }: { action: Action }) {
  const [error, setError] = useState<string | undefined>();
  const t = useT();

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      e.preventDefault();
      setError(t("Nama toko wajib diisi.", "Store name is required."));
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
      <Field label={t("Nama toko", "Store name")}>
        {/* error diposisikan absolute supaya munculnya tidak menggeser baris (input & tombol tetap sejajar) */}
        <div className="relative w-full sm:w-80">
          <input
            name="name"
            onInput={() => error && setError(undefined)}
            placeholder={t("ex: Luxe Supplement Store, Shopee", "e.g. Luxe Supplement Store, Shopee")}
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
        pendingText={t("Menyimpan…", "Saving…")}
      >
        {t("Tambah Toko", "Add Store")}
      </SubmitButton>
    </form>
  );
}
