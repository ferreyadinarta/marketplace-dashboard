import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

// Lindungi seluruh route kecuali /login & aset statis.
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const ok = await verifySession(process.env.AUTH_SECRET ?? "", req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
