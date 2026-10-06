"use client";

import { useState, type ReactNode } from "react";
import { Settings2, ChevronDown } from "lucide-react";
import { Collapse } from "@/components/Collapse";
import { useT } from "@/components/LangProvider";

// Bagian pengaturan API yang bisa dilipat. Default tertutup supaya tidak
// membingungkan user yang cuma perlu atur nama & marketplace.
export function AdvancedApiSection({
  connected,
  defaultOpen = false,
  children,
}: {
  connected: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const t = useT();
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
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
