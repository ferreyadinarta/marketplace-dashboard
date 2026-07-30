import { NextRequest, NextResponse } from "next/server";
import { getAuthorizeUrl } from "@/lib/shopee/client";
import { shopeeConfigured } from "@/lib/shopee/config";

export const dynamic = "force-dynamic";

// Mulai flow authorize Shopee: redirect user ke halaman izin Shopee.
export async function GET(req: NextRequest) {
  if (!shopeeConfigured()) {
    return NextResponse.redirect(new URL("/master/toko?shopee=notconfigured", req.url));
  }
  return NextResponse.redirect(getAuthorizeUrl());
}
