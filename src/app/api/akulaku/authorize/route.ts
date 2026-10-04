import { NextRequest, NextResponse } from "next/server";
import { getAuthorizeUrl } from "@/lib/akulaku/client";
import { akulakuConfigured } from "@/lib/akulaku/config";

export const dynamic = "force-dynamic";

// Mulai authorize Akulaku: seller login & izinkan toko
export async function GET(req: NextRequest) {
  if (!akulakuConfigured()) {
    return NextResponse.redirect(new URL("/master/toko?akulaku=notconfigured", req.url));
  }
  return NextResponse.redirect(getAuthorizeUrl());
}
