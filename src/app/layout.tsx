import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pembukuan Marketplace",
  description: "Pembukuan terpadu Shopee, TikTok Shop, Tokopedia",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
