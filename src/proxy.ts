import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { IS_DEMO } from "@/lib/config";

const DEMO_API = ["/api/health", "/api/sync/progress", "/api/export"];

// Endpoint publik (server-to-server / redirect luar) yang TIDAK boleh kena gate
// sesi login. Masing-masing punya auth sendiri:
//  - OAuth callback: redirect dari marketplace, browser seller mungkin belum login
//  - webhook/push: request server Shopee, diverifikasi via tanda tangan
//  - cron: dipanggil Vercel Cron, diproteksi CRON_SECRET
const PUBLIC_PATHS = [
  "/api/tiktok/callback",
  "/api/shopee/callback",
  "/api/shopee/webhook",
  "/api/cron/",
  "/api/health", // keep-warm / uptime ping (tanpa login)
  "/sw.js", // service worker push (di-fetch browser, kadang tanpa cookie)
  "/manifest.webmanifest", // PWA manifest (di-fetch browser untuk install)
  // Ikon notifikasi & PWA: di-fetch browser/OS, sering TANPA cookie sesi.
  // Kalau kena redirect ke /login, ikonnya gagal dimuat → notifikasi tampil
  // sebagai kotak putih dan ikon home screen kosong.
  "/icon-192.png",
  "/icon-512.png",
  "/badge-96.png",
  "/apple-touch-icon.png",
];

// Lindungi seluruh route kecuali /login & aset statis.
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (IS_DEMO) {
    if (pathname.startsWith("/api/")) {
      const readable = req.method === "GET" && DEMO_API.some((p) => pathname.startsWith(p));
      return readable
        ? NextResponse.next()
        : NextResponse.json({ error: "Read-only demo: changes are turned off." }, { status: 403 });
    }
    if (pathname === "/login") {
      const home = req.nextUrl.clone();
      home.pathname = "/";
      home.search = "";
      return NextResponse.redirect(home);
    }
    return NextResponse.next();
  }

  if (pathname === "/login" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const ok = await verifySession(process.env.AUTH_SECRET ?? "", req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?)).*)"],
};
