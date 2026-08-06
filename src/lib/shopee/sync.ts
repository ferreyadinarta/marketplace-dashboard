import type { Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestOrders } from "@/lib/sync";
import type { NormalizedOrder } from "@/lib/adapters/types";
import type { ImportedProduct } from "@/lib/adapters/types";
import {
  refreshAccessToken,
  getOrderSnList,
  getOrderDetails,
  getEscrowDetail,
  fetchShopeeCatalog,
  shopeeSku,
  type ShopeeOrderDetail,
  type ShopeeIncome,
} from "./client";

// Pastikan access token masih valid (Shopee token cuma 4 jam) → refresh bila
// hampir kadaluarsa, simpan yang baru. Balikin access token siap pakai.
async function ensureFreshToken(store: Store): Promise<string> {
  if (!store.accessToken || !store.shopIdApi) {
    throw new Error(`Toko "${store.name}" belum terhubung (authorize dulu).`);
  }
  let accessToken = store.accessToken;
  const soon = Date.now() + 10 * 60 * 1000;
  if (store.tokenExpiresAt && store.tokenExpiresAt.getTime() < soon && store.refreshToken) {
    const t = await refreshAccessToken(store.refreshToken, store.shopIdApi);
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
  return accessToken;
}

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
    const baseName = li.item_name || "(tanpa nama)";
    return {
      // aturan SKU HARUS sama dengan import katalog (lihat shopeeSku) supaya
      // order otomatis ketemu mapping product-nya, walau listing tanpa SKU.
      marketplaceSku: shopeeSku({
        itemSku: li.item_sku,
        modelSku: li.model_sku,
        itemId: li.item_id,
        modelId: li.model_id,
      }),
      productName: li.model_name ? `${baseName} - ${li.model_name}` : baseName,
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
    marketplaceFee: 0, // diisi dari escrow (lihat normalizeWithFees)
    shippingSubsidy: 0,
    netAmount: subtotal,
    items,
  };
}

// Total fee marketplace yang dipotong Shopee dari income detail.
function feeFromIncome(inc: ShopeeIncome): number {
  const f =
    (inc.commission_fee ?? 0) +
    (inc.service_fee ?? 0) +
    (inc.seller_transaction_fee ?? 0) +
    (inc.credit_card_transaction_fee ?? 0) +
    (inc.campaign_fee ?? 0);
  return Number.isFinite(f) ? Math.round(f) : 0;
}

// Normalisasi + ambil fee escrow per order. Escrow di-skip HANYA untuk UNPAID
// (belum dibayar → escrow pasti belum ada). CANCELLED & RETURNED tetap dicek:
// Shopee sering masih memotong sebagian fee / ada penyesuaian refund, jadi butuh
// datanya biar pembukuan akurat. Escrow gagal → fee tetap 0, sync jalan terus.
async function normalizeWithFees(
  accessToken: string,
  shopId: string,
  details: ShopeeOrderDetail[]
): Promise<NormalizedOrder[]> {
  const out: NormalizedOrder[] = [];
  for (const o of details) {
    const order = normalize(o);
    const st = (o.order_status || "").toUpperCase();
    if (st !== "UNPAID") {
      const inc = await getEscrowDetail(accessToken, shopId, o.order_sn);
      if (inc) {
        order.marketplaceFee = feeFromIncome(inc);
        if (inc.escrow_amount != null && Number.isFinite(inc.escrow_amount)) {
          order.netAmount = Math.round(inc.escrow_amount);
        }
      }
    }
    out.push(order);
  }
  return out;
}

// Sync satu toko Shopee: refresh token kalau perlu → ambil order → normalisasi → simpan.
export async function syncShopeeStore(storeId: string, from: Date, to: Date) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  const accessToken = await ensureFreshToken(store);
  const shopId = store.shopIdApi!;

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
  const normalized = await normalizeWithFees(accessToken, shopId, details);
  const r = await ingestOrders(store.id, normalized);
  await prisma.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
  return r;
}

// Ambil katalog product toko Shopee (untuk import ke Master Product).
export async function getShopeeCatalog(storeId: string): Promise<ImportedProduct[]> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  const accessToken = await ensureFreshToken(store);
  return fetchShopeeCatalog(accessToken, store.shopIdApi!);
}

// Sync order tertentu berdasarkan order_sn (dipakai webhook realtime Shopee).
// Hanya tarik detail order yang di-push → jauh lebih ringan daripada scan penuh.
export async function syncShopeeOrders(storeId: string, orderSns: string[]) {
  if (!orderSns.length) return { created: 0, updated: 0, unmapped: 0 };
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  const accessToken = await ensureFreshToken(store);
  const shopId = store.shopIdApi!;

  const details = await getOrderDetails(accessToken, shopId, orderSns);
  const normalized = await normalizeWithFees(accessToken, shopId, details);
  const r = await ingestOrders(store.id, normalized);
  await prisma.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
  return r;
}
