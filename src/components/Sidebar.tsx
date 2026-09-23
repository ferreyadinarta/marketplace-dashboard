"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Wallet,
  Package,
  Boxes,
  Store,
  Link2,
  Handshake,
  MessageCircle,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/ui";
import { logout } from "@/app/login/actions";
import { LangToggle } from "@/components/LangToggle";
import { useT } from "@/components/LangProvider";
import type { T } from "@/lib/i18n";

// Dikelompokkan per tugas user: lihat hasil → catat harian → atur data.
function navGroups(t: T) {
  return [
    {
      label: t("Lihat hasil", "Results"),
      items: [
        { href: "/", label: "Dashboard", desc: t("Omzet & profit", "Revenue & profit"), icon: LayoutDashboard },
        { href: "/pembukuan", label: t("Pembukuan", "Bookkeeping"), desc: t("Rincian per product", "Breakdown per product"), icon: BookOpen },
        { href: "/rekonsiliasi", label: t("Dana Cair", "Payouts"), desc: t("Uang dari marketplace", "Money from marketplaces"), icon: Wallet },
      ],
    },
    {
      label: t("Catat harian", "Daily records"),
      items: [
        { href: "/wa", label: t("Penjualan WA", "WA Sales"), desc: t("Jual manual / offline", "Manual / offline sales"), icon: MessageCircle },
        { href: "/konsinyasi", label: t("Grosir / Reseller", "Wholesale / Reseller"), desc: t("Jual putus ke reseller", "Outright sales to resellers"), icon: Handshake },
        { href: "/stok", label: t("Stok", "Stock"), desc: t("Barang masuk & opname", "Stock in & stock counts"), icon: Boxes },
      ],
    },
    {
      label: t("Atur data", "Manage data"),
      items: [
        { href: "/master/product", label: "Product", desc: t("Nama, HPP, harga", "Name, COGS, price"), icon: Package },
        { href: "/master/toko", label: t("Toko", "Stores"), desc: t("Hubungkan marketplace", "Connect marketplaces"), icon: Store },
        { href: "/master/mapping", label: t("Mapping SKU", "SKU Mapping"), desc: t("Hubungkan SKU ke product", "Link SKUs to products"), icon: Link2 },
      ],
    },
  ];
}

export default function Sidebar({ env }: { env: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isSandbox = env !== "production";
  const t = useT();
  const groups = navGroups(t);

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
          <p className="text-xs text-slate-500">{t("Pembukuan", "Bookkeeping")}</p>
        </div>
      </div>

      {/* mode indicator — hanya tampil saat sandbox (peringatan data uji).
          Di production sengaja disembunyikan. */}
      {isSandbox && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {t("Mode Sandbox", "Sandbox mode")}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1 text-xs font-semibold text-slate-400">
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
                    onClick={() => setOpen(false)}
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

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-3">
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut size={16} className="text-slate-400" /> {t("Keluar", "Log out")}
          </button>
        </form>
        <LangToggle />
      </div>
    </>
  );

  return (
    <>
      {/* Top bar — mobile only. pt safe-area supaya tidak ketutup notch/status bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex min-h-14 items-center gap-3 border-b border-slate-200 bg-white pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pt-[env(safe-area-inset-top)] lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label={t("Buka menu", "Open menu")}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200"
        >
          <Menu size={22} />
        </button>
        <Logo size={28} />
        <span className="text-sm font-bold text-slate-900">Marketplace</span>
      </header>

      {/* Overlay — mobile drawer */}
      {open && (
        <div
          className="animate-fade fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer (mobile) / fixed sidebar (desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] transition-transform duration-200 lg:translate-x-0 lg:border-r lg:border-slate-200 lg:pt-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:shadow-none"
        }`}
      >
        {/* tombol tutup — mobile */}
        <button
          onClick={() => setOpen(false)}
          aria-label={t("Tutup menu", "Close menu")}
          className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <X size={18} />
        </button>
        {nav}
      </aside>
    </>
  );
}
