import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppToken, getShopInfo } from "@/lib/akulaku/client";

export const dynamic = "force-dynamic";

// Akulaku balik ke sini membawa ?shopId=..&siteName=ec. Butuh sesi login app (tidak publik).
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId") ?? req.nextUrl.searchParams.get("ShopId");
  const back = (q: string) => NextResponse.redirect(new URL(`/master/toko?${q}`, req.url));
  if (!shopId || !/^\d+$/.test(shopId)) return back("akulaku=error&reason=noshop");

  try {
    const token = await getAppToken();
    // nama + logo opsional, jangan gagalkan authorize
    const info = await getShopInfo(token.accessToken, shopId).catch(() => undefined);

    const base = {
      marketplace: "AKULAKU",
      shopIdApi: shopId,
      logoUrl: info?.logoImg ?? null,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
      isActive: true,
    };
    const existing = await prisma.store.findFirst({ where: { marketplace: "AKULAKU", shopIdApi: shopId } });
    if (existing) await prisma.store.update({ where: { id: existing.id }, data: base });
    else await prisma.store.create({ data: { ...base, name: info?.shopName || `Akulaku ${shopId}` } });

    return back("akulaku=connected");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return back(`akulaku=error&reason=${encodeURIComponent(msg)}`);
  }
}
