import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeToken, getAuthorizedShops } from "@/lib/tiktok/client";

export const dynamic = "force-dynamic";

// TikTok redirect ke sini setelah seller authorize, membawa `code`.
// Kita tukar code → token, ambil daftar shop, lalu simpan sebagai toko.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const back = (q: string) => NextResponse.redirect(new URL(`/master/toko?${q}`, req.url));

  if (!code) return back("tiktok=error&reason=nocode");

  try {
    const token = await exchangeToken(code);
    const shops = await getAuthorizedShops(token.accessToken);
    const tokenExpiresAt = new Date(token.accessTokenExpireAt * 1000);

    let n = 0;
    for (const shop of shops) {
      const data = {
        name: shop.name || `TikTok Shop ${shop.id}`,
        marketplace: "TIKTOK",
        shopIdApi: shop.id,
        shopCipher: shop.cipher,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt,
        isActive: true,
      };
      const existing = await prisma.store.findFirst({
        where: { marketplace: "TIKTOK", shopIdApi: shop.id },
      });
      if (existing) await prisma.store.update({ where: { id: existing.id }, data });
      else await prisma.store.create({ data });
      n++;
    }

    return back(`tiktok=connected&n=${n}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return back(`tiktok=error&reason=${encodeURIComponent(msg)}`);
  }
}
