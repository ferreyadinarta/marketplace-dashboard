import { prisma } from "@/lib/prisma";
import { ingestOrders } from "@/lib/sync";
import type { NormalizedOrder, ImportedProduct } from "@/lib/adapters/types";
import type { ProgressFn } from "@/lib/syncProgress";
import {
  refreshAccessToken,
  searchOrders,
  searchProducts,
  type TiktokOrder,
} from "./client";

function toNum(v?: string): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// map status TikTok → status internal
function mapStatus(s: string): NormalizedOrder["status"] {
  const up = (s || "").toUpperCase();
  if (up === "COMPLETED") return "COMPLETED";
  if (up === "CANCELLED" || up === "CANCEL") return "CANCELLED";
  if (up === "DELIVERED" || up === "IN_TRANSIT" || up === "AWAITING_COLLECTION") return "SHIPPED";
  return "PENDING";
}

// TikTok order → NormalizedOrder.
// CATATAN v1: fee/komisi marketplace belum diambil (butuh Finance API terpisah);
// sementara fee=0, akan disempurnakan saat sync settlement.
function normalize(o: TiktokOrder): NormalizedOrder {
  const items = (o.line_items ?? []).map((li) => {
    const price = toNum(li.sale_price ?? li.original_price);
    const qty = li.quantity ?? 1;
    return {
      marketplaceSku: li.seller_sku || li.sku_id || "",
      productName: li.product_name || "(tanpa nama)",
      qty,
      price,
      subtotal: price * qty,
    };
  });
  const subtotal = items.reduce((a, it) => a + it.subtotal, 0);
  const shipping = toNum(o.payment?.shipping_fee);
  const total = toNum(o.payment?.total_amount) || subtotal;

  return {
    marketplaceOrderId: o.id,
    orderDate: new Date(o.create_time * 1000),
    status: mapStatus(o.status),
    buyerName: o.buyer_email ?? o.user_id ?? undefined,
    totalAmount: subtotal, // omzet = nilai produk
    marketplaceFee: 0, // TODO: dari Finance/settlement API
    shippingSubsidy: 0,
    netAmount: subtotal,
    // simpan info tambahan tidak dipakai sekarang: total, shipping
    items,
  };
}

// Sync satu toko TikTok: refresh token kalau perlu → ambil order → normalisasi → simpan.
export async function syncTiktokStore(
  storeId: string,
  from: Date,
  to: Date,
  opts: { onProgress?: ProgressFn } = {}
) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  if (!store.accessToken || !store.shopCipher) {
    throw new Error(`Toko "${store.name}" belum terhubung (authorize dulu).`);
  }

  let accessToken = store.accessToken;

  // refresh token kalau sudah/hampir kadaluarsa
  const soon = Date.now() + 5 * 60 * 1000;
  if (store.tokenExpiresAt && store.tokenExpiresAt.getTime() < soon && store.refreshToken) {
    const t = await refreshAccessToken(store.refreshToken);
    accessToken = t.accessToken;
    await prisma.store.update({
      where: { id: store.id },
      data: {
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        tokenExpiresAt: new Date(t.accessTokenExpireAt * 1000),
      },
    });
  }

  // TikTok membatasi rentang waktu per query → pecah jadi window 7 hari.
  const WINDOW = 7 * 24 * 3600;
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  const orders: TiktokOrder[] = [];
  const windowTotal = Math.max(1, Math.ceil((toSec - fromSec) / WINDOW));
  let wi = 0;
  await opts.onProgress?.({ phase: "orders", windowTotal, windowIndex: 0, message: `Menarik order ${store.name}…` });
  for (let start = fromSec; start < toSec; start += WINDOW) {
    const end = Math.min(start + WINDOW, toSec);
    const chunk = await searchOrders(accessToken, store.shopCipher, start, end);
    orders.push(...chunk);
    wi++;
    await opts.onProgress?.({
      windowIndex: wi,
      ordersDone: orders.length,
      message: `Periode ${wi}/${windowTotal} · ${orders.length} order dipindai`,
    });
  }

  const normalized = orders.map(normalize);
  return ingestOrders(store.id, normalized);
}

// Ambil katalog product toko TikTok (untuk import ke Master Product).
export async function getTiktokCatalog(storeId: string): Promise<ImportedProduct[]> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  if (!store.accessToken || !store.shopCipher) {
    throw new Error(`Toko "${store.name}" belum terhubung (authorize dulu).`);
  }

  let accessToken = store.accessToken;
  const soon = Date.now() + 5 * 60 * 1000;
  if (store.tokenExpiresAt && store.tokenExpiresAt.getTime() < soon && store.refreshToken) {
    const t = await refreshAccessToken(store.refreshToken);
    accessToken = t.accessToken;
    await prisma.store.update({
      where: { id: store.id },
      data: {
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        tokenExpiresAt: new Date(t.accessTokenExpireAt * 1000),
      },
    });
  }

  const products = await searchProducts(accessToken, store.shopCipher);
  const out: ImportedProduct[] = [];
  for (const p of products) {
    const skus = p.skus ?? [];
    if (skus.length === 0) {
      out.push({ sku: "", name: p.title || "(tanpa nama)", price: 0 });
      continue;
    }
    for (const s of skus) {
      const price = parseFloat(s.price?.sale_price ?? "0");
      out.push({
        sku: s.seller_sku || "",
        name: p.title || "(tanpa nama)",
        price: Number.isFinite(price) ? Math.round(price) : 0,
      });
    }
  }
  return out;
}
