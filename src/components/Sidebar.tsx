"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Wallet,
  Package,
  Store,
  Link2,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui";

const groups = [
  {
    label: "Laporan",
    items: [
      { href: "/", label: "Dashboard", desc: "Ringkasan & profit", icon: LayoutDashboard },
      { href: "/pembukuan", label: "Pembukuan", desc: "Per grup product", icon: BookOpen },
      { href: "/rekonsiliasi", label: "Rekonsiliasi Dana", desc: "Cek dana cair", icon: Wallet },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      { href: "/master/product", label: "Master Product", desc: "Product, HPP, grup", icon: Package },
      { href: "/master/toko", label: "Master Toko", desc: "Nama toko & marketplace", icon: Store },
      { href: "/master/mapping", label: "Mapping SKU", desc: "Samakan SKU", icon: Link2 },
    ],
  },
];

export default function Sidebar({ env }: { env: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isSandbox = env !== "production";

  // tutup drawer tiap pindah halaman
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const nav = (
    <>
      {/* brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo size={40} />
        <div>
          <p className="text-sm font-bold leading-tight text-slate-900">Marketplace</p>
          <p className="text-xs text-slate-500">Pembukuan</p>
        </div>
      </div>

      {/* mode indicator — hanya tampil saat sandbox (peringatan data uji).
          Di production sengaja disembunyikan. */}
      {isSandbox && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Mode Sandbox (data uji)
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.label}</p>
                      <p className={`truncate text-xs ${active ? "text-indigo-400" : "text-slate-400"}`}>
                        {item.desc}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-400">Butuh bantuan? Lihat SETUP.md</p>
      </div>
    </>
  );

  return (
    <>
      {/* Top bar — mobile only */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <Menu size={20} />
        </button>
        <Logo size={28} />
        <span className="text-sm font-bold text-slate-900">Marketplace</span>
      </header>

      {/* Overlay — mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer (mobile) / fixed sidebar (desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white transition-transform duration-200 lg:translate-x-0 lg:border-r lg:border-slate-200 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:shadow-none"
        }`}
      >
        {/* tombol tutup — mobile */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <X size={18} />
        </button>
        {nav}
      </aside>
    </>
  );
}
