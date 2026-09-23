"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Buka/tutup dengan tinggi yang mengalir (grid-rows 0fr → 1fr), bukan loncat.
// Isi tetap ter-mount supaya animasi tutup juga halus; saat tertutup dibuat
// inert biar tidak bisa di-tab/diklik.
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  // overflow baru dibuka setelah animasi selesai — kalau langsung visible, isi
  // "tumpah" menimpa elemen di bawah selama tinggi masih tumbuh; kalau hidden
  // terus, elemen sticky di dalamnya tidak bisa nempel.
  const [settled, setSettled] = useState(open);

  return (
    <div
      inert={!open}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "grid-template-rows") setSettled(open);
      }}
      className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className={`min-h-0 ${open && settled ? "overflow-visible" : "overflow-hidden"}`}>
        <div
          className={`transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// Kartu yang bisa dilipat, untuk dipakai dari server component (pengganti <details>).
export function Disclosure({
  defaultOpen = false,
  icon,
  title,
  subtitle,
  children,
}: {
  defaultOpen?: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {icon}
        <span className="flex-1">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          <span className="block text-xs text-slate-500">{subtitle}</span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <Collapse open={open}>{children}</Collapse>
    </div>
  );
}
