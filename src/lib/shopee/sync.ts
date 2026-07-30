import { prisma } from "@/lib/prisma";
import { ingestOrders } from "@/lib/sync";
import type { NormalizedOrder } from "@/lib/adapters/types";
import {
  refreshAccessToken,
  getOrderSnList,
  getOrderDetails,
  type ShopeeOrderDetail,
} from "./client";

// map status Shopee → status internal
function mapStatus(s: string): NormalizedOrder["status"] {
  const up = (s || "").toUpperCase();
  if (up === "COMPLETED") return "COMPLETED";
  if (up === "CANCELLED" || up === "IN_CANCEL") return "CANCELLED";
  if (up === "TO_RETURN") return "RETURNED";
  if (up === "SHIPPED" || up === "PROCESSED" || up === "READY_TO_SHIP") return "SHIPPED";
  return "PENDING";
}

// Shopee harga sudah dalam satuan rupiah (float, ex 25000.0) → bulatkan.
function toRp(v?: number): number {
  if (v == null) return 0;
  return Number.isFinite(v) ? Math.round(v) : 0;
}

// Shopee order → NormalizedOrder.
// CATATAN v1: fee marketplace belum diambil (butuh get_escrow_detail terpisah);
// sementara fee=0, disempurnakan saat sync settlement.
function normalize(o: ShopeeOrderDetail): NormalizedOrder {
  const items = (o.item_list ?? []).map((li) => {
    const price = toRp(li.model_discounted_price ?? li.model_original_price);
    const qty = li.model_quantity_purchased ?? 1;
    return {
      marketplaceSku: li.model_sku || li.item_sku || "",
      productName: li.item_name || "(tanpa nama)",
      qty,
      price,
      subtotal: price * qty,
    };
  });
  const subtotal = items.reduce((a, it) => a + it.subtotal, 0);

  return {
    marketplaceOrderId: o.order_sn,
    orderDate: new Date(o.create_time * 1000),
    status: mapStatus(o.order_status),
    buyerName: o.buyer_username ?? undefined,
    totalAmount: subtotal, // omzet = nilai produk
    marketplaceFee: 0, // TODO: get_escrow_detail
    shippingSubsidy: 0,
    netAmount: subtotal,
    items,
  };
}

// Sync satu toko Shopee: refresh token kalau perlu → ambil order → normalisasi → simpan.
export async function syncShopeeStore(storeId: string, from: Date, to: Date) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  if (!store.accessToken || !store.shopIdApi) {
    throw new Error(`Toko "${store.name}" belum terhubung (authorize dulu).`);
  }

  let accessToken = store.accessToken;
  const shopId = store.shopIdApi;

  // token Shopee cuma 4 jam → refresh kalau hampir kadaluarsa.
  const soon = Date.now() + 10 * 60 * 1000;
  if (store.tokenExpiresAt && store.tokenExpiresAt.getTime() < soon && store.refreshToken) {
    const t = await refreshAccessToken(store.refreshToken, shopId);
    accessToken = t.accessToken;
    await prisma.store.update({
      where: { id: store.id },
      data: {
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        tokenExpiresAt: new Date(Date.now() + t.expireIn * 1000),
      },
    });
  }

  // Shopee batasi window get_order_list ≤ 15 hari → pecah.
  const WINDOW = 15 * 24 * 3600;
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  const sns: string[] = [];
  for (let start = fromSec; start < toSec; start += WINDOW) {
    const end = Math.min(start + WINDOW, toSec);
    const chunk = await getOrderSnList(accessToken, shopId, start, end);
    sns.push(...chunk);
  }

  const details = await getOrderDetails(accessToken, shopId, sns);
  const normalized = details.map(normalize);
  const r = await ingestOrders(store.id, normalized);
  await prisma.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
  return r;
}
