import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard Marketplace",
  description: "Pembukuan terpadu Shopee, TikTok Shop, Tokopedia",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/pembukuan", label: "Pembukuan" },
  { href: "/rekonsiliasi", label: "Rekonsiliasi Dana" },
  { href: "/master/product", label: "Master Product" },
  { href: "/master/toko", label: "Master Toko" },
  { href: "/master/mapping", label: "Mapping SKU" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="flex min-h-screen">
          <aside className="w-60 shrink-0 border-r border-slate-200 bg-white">
            <div className="px-5 py-5 border-b border-slate-200">
              <h1 className="text-lg font-bold">Marketplace</h1>
              <p className="text-xs text-slate-500">Pembukuan Terpadu</p>
            </div>
            <nav className="p-3 space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8 max-w-[1400px]">{children}</main>
        </div>
      </body>
    </html>
  );
}
