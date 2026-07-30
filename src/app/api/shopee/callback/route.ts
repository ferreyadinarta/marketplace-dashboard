import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeToken } from "@/lib/shopee/client";

export const dynamic = "force-dynamic";

// Shopee redirect ke sini setelah seller authorize, membawa `code` + `shop_id`.
// Tukar code → token, simpan sebagai toko Shopee.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const shopId = req.nextUrl.searchParams.get("shop_id");
  const back = (q: string) => NextResponse.redirect(new URL(`/master/toko?${q}`, req.url));

  if (!code || !shopId) return back("shopee=error&reason=nocode");

  try {
    const token = await exchangeToken(code, shopId);
    const tokenExpiresAt = new Date(Date.now() + token.expireIn * 1000);

    const base = {
      marketplace: "SHOPEE",
      shopIdApi: shopId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt,
      isActive: true,
    };

    const existing = await prisma.store.findFirst({
      where: { marketplace: "SHOPEE", shopIdApi: shopId },
    });
    if (existing) {
      // jangan timpa nama toko yang mungkin sudah diedit user
      await prisma.store.update({ where: { id: existing.id }, data: base });
    } else {
      await prisma.store.create({ data: { ...base, name: `Shopee ${shopId}` } });
    }

    return back("shopee=connected");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return back(`shopee=error&reason=${encodeURIComponent(msg)}`);
  }
}
