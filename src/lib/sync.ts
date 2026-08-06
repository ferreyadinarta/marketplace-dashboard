import { prisma } from "./prisma";
import { adapters } from "./adapters";
import { effectiveHppMap } from "./bundle";
import type { NormalizedOrder } from "./adapters/types";

// Simpan order hasil normalisasi ke DB. Idempotent: order yang sudah ada
// (storeId + marketplaceOrderId) di-update, tidak dobel.
// SKU yang belum ter-mapping tetap disimpan (productId null) → muncul di
// halaman Mapping SKU untuk dipetakan manual.
export async function ingestOrders(storeId: string, orders: NormalizedOrder[]) {
  let created = 0;
  let updated = 0;
  let unmapped = 0;

  for (const o of orders) {
    // cari mapping SKU → product internal untuk tiap item
    const itemsData = await Promise.all(
      o.items.map(async (it) => {
        const mapping = await prisma.productMapping.findUnique({
          where: { storeId_marketplaceSku: { storeId, marketplaceSku: it.marketplaceSku } },
        });
        if (!mapping?.productId) unmapped++;

        // pastikan mapping baris ada (walau productId null) biar tampil di UI
        if (!mapping) {
          await prisma.productMapping.create({
            data: {
              storeId,
              marketplaceSku: it.marketplaceSku,
              marketplaceProductName: it.productName,
            },
          });
        }

        // Varian marketplace bisa "1 box (16 sachet)" atau "10 sachet" untuk
        // product DASAR yang sama → konversi ke satuan dasar pakai faktor mapping,
        // kalau tidak stok berkurang salah (1 box dihitung 1 sachet).
        const factor = Math.max(1, mapping?.baseQtyPerUnit ?? 1);
        return {
          productId: mapping?.productId ?? null,
          marketplaceSku: it.marketplaceSku,
          productName: it.productName,
          qty: it.qty,
          baseQty: it.qty * factor,
          price: it.price,
          subtotal: it.subtotal,
        };
      })
    );

    // bekukan HPP per item (bundle = Σ isi). Item belum ter-mapping → 0 (fallback nanti).
    const hppMap = await effectiveHppMap(
      itemsData.map((i) => i.productId).filter((id): id is string => !!id)
    );
    const itemsWithHpp = itemsData.map((i) => ({
      ...i,
      hppSnapshot: i.productId ? hppMap.get(i.productId) ?? 0 : 0,
    }));

    const existing = await prisma.order.findUnique({
      where: { storeId_marketplaceOrderId: { storeId, marketplaceOrderId: o.marketplaceOrderId } },
    });

    if (existing) {
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          status: o.status,
          buyerName: o.buyerName ?? existing.buyerName,
          totalAmount: o.totalAmount,
          marketplaceFee: o.marketplaceFee,
          shippingSubsidy: o.shippingSubsidy,
          netAmount: o.netAmount,
        },
      });
      updated++;
    } else {
      await prisma.order.create({
        data: {
          storeId,
          marketplaceOrderId: o.marketplaceOrderId,
          orderDate: o.orderDate,
          status: o.status,
          buyerName: o.buyerName ?? null,
          totalAmount: o.totalAmount,
          marketplaceFee: o.marketplaceFee,
          shippingSubsidy: o.shippingSubsidy,
          netAmount: o.netAmount,
          items: { create: itemsWithHpp },
        },
      });
      created++;
    }
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { lastSyncAt: new Date() },
  });

  return { created, updated, unmapped };
}

// Sync satu toko: ambil dari adapter → normalisasi → simpan.
export async function syncStore(storeId: string, from: Date, to: Date) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  if (!store.apiKey || !store.apiSecret || !store.shopIdApi) {
    throw new Error(`Kredensial API toko "${store.name}" belum lengkap`);
  }

  const adapter = adapters[store.marketplace];
  if (!adapter) throw new Error(`Adapter ${store.marketplace} tidak ada`);

  const orders = await adapter.fetchOrders({
    apiKey: store.apiKey,
    apiSecret: store.apiSecret,
    shopIdApi: store.shopIdApi,
    from,
    to,
  });

  return ingestOrders(storeId, orders);
}
