import { NextRequest, NextResponse } from "next/server";
import { getAuthorizeUrl } from "@/lib/tiktok/client";
import { tiktokConfigured, TIKTOK } from "@/lib/tiktok/config";

export const dynamic = "force-dynamic";

// Mulai flow authorize TikTok: redirect user ke halaman izin TikTok.
export async function GET(req: NextRequest) {
  if (!tiktokConfigured() || !TIKTOK.serviceId) {
    return NextResponse.redirect(new URL("/master/toko?tiktok=notconfigured", req.url));
  }
  const state = crypto.randomUUID();
  return NextResponse.redirect(getAuthorizeUrl(state));
}
