import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import { APP_ENV } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard Marketplace",
  description: "Pembukuan terpadu Shopee, TikTok Shop, Tokopedia",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <Sidebar env={APP_ENV} />
        <div className="lg:pl-64">
          <main className="mx-auto max-w-[1400px] px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
