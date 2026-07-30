import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPush } from "@/lib/shopee/sign";
import { SHOPEE } from "@/lib/shopee/config";
import { syncShopeeOrders } from "@/lib/shopee/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Shopee kadang cek endpoint dengan GET → balas 2xx.
export async function GET() {
  return NextResponse.json({ ok: true });
}

// Push realtime Shopee (Push Mechanism). Shopee POST ke sini tiap ada event.
// code penting: 3 = order status update, 2 = shop deauthorization.
//
// PENTING: Shopee cuma peduli response 2xx. Kalau kita balas non-2xx (mis. 401),
// "Verify and Save" GAGAL dan push dianggap error. Jadi SELALU balas 200 —
// verifikasi tanda tangan cuma menentukan APAKAH event diproses, bukan status HTTP.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const auth = req.headers.get("authorization");

  // Tanda tangan tidak valid (mis. verifikasi "Verify and Save", atau push palsu)
  // → jangan proses, tapi tetap 200 supaya verifikasi Shopee lolos.
  if (!verifyPush(raw, auth, SHOPEE.webhookUrl)) {
    return NextResponse.json({ ok: true });
  }

  let body: { code?: number; shop_id?: number; data?: { ordersn?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const code = body.code;
  const shopId = body.shop_id != null ? String(body.shop_id) : "";

  try {
    if (code === 3 && shopId && body.data?.ordersn) {
      // order berubah status → tarik detail order itu saja & simpan
      const store = await prisma.store.findFirst({
        where: { marketplace: "SHOPEE", shopIdApi: shopId },
      });
      if (store) await syncShopeeOrders(store.id, [String(body.data.ordersn)]);
    } else if (code === 2 && shopId) {
      // shop mencabut izin → tandai toko tidak terhubung lagi
      const store = await prisma.store.findFirst({
        where: { marketplace: "SHOPEE", shopIdApi: shopId },
      });
      if (store) {
        await prisma.store.update({
          where: { id: store.id },
          data: { accessToken: null, refreshToken: null, tokenExpiresAt: null },
        });
      }
    }
  } catch {
    // Jangan paksa Shopee retry berulang untuk error internal kita —
    // cron reconciliasi harian akan menambal order yang kelewat. Tetap balas 200.
  }

  return NextResponse.json({ ok: true });
}
