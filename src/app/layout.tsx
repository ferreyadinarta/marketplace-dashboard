import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n-server";
import { LangProvider } from "@/components/LangProvider";

// judul tab ikut bahasa pilihan
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    ...baseMetadata,
    title: lang === "en" ? "Marketplace Bookkeeping" : "Pembukuan Marketplace",
    description:
      lang === "en"
        ? "Unified bookkeeping for Shopee, TikTok Shop and Tokopedia"
        : "Pembukuan terpadu Shopee, TikTok Shop, Tokopedia",
  };
}

const baseMetadata: Metadata = {
  applicationName: "Pembukuan",
  // biar terasa seperti app native saat di-install ke Home Screen (iOS)
  appleWebApp: {
    capable: true,
    title: "Pembukuan",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  // isi penuh sampai tepi layar (di belakang notch); ditangani via safe-area di CSS
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
