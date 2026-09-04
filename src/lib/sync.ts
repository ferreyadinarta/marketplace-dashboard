import { prisma } from "./prisma";
import { adapters } from "./adapters";
import { effectiveHppMap } from "./bundle";
import type { NormalizedOrder } from "./adapters/types";

const WRITE_CHUNK = 25;

// Simpan order hasil normalisasi ke DB. Idempotent: order yang sudah ada
// (storeId + marketplaceOrderId) di-update, tidak dobel.
// SKU yang belum ter-mapping tetap disimpan (productId null) → muncul di
// halaman Mapping SKU untuk dipetakan manual.
export async function ingestOrders(storeId: string, ordersInput: NormalizedOrder[]) {
  let orders = ordersInput;
  let created = 0;
  let updated = 0;
  let unmapped = 0;

  if (orders.length === 0) {
    await prisma.store.update({ where: { id: storeId }, data: { lastSyncAt: new Date() } });
    return { created, updated, unmapped };
  }

  // order_sn bisa dobel antar halaman paging; yang terakhir menang
  const byId = new Map<string, NormalizedOrder>();
  for (const o of orders) byId.set(o.marketplaceOrderId, o);
  orders = [...byId.values()];

  const skus = [...new Set(orders.flatMap((o) => o.items.map((it) => it.marketplaceSku)))];
  const mappingRows = await prisma.productMapping.findMany({
    where: { storeId, marketplaceSku: { in: skus } },
    select: { marketplaceSku: true, productId: true, baseQtyPerUnit: true },
  });
  const mappings = new Map(mappingRows.map((m) => [m.marketplaceSku, m]));

  // SKU tanpa baris mapping tetap dibuat biar muncul di halaman Mapping SKU
  const missing = new Map<string, string>();
  for (const o of orders) {
    for (const it of o.items) {
      if (!mappings.has(it.marketplaceSku) && !missing.has(it.marketplaceSku)) {
        missing.set(it.marketplaceSku, it.productName);
      }
    }
  }
  if (missing.size) {
    await prisma.productMapping.createMany({
      data: [...missing].map(([marketplaceSku, marketplaceProductName]) => ({
        storeId,
        marketplaceSku,
        marketplaceProductName,
      })),
      skipDuplicates: true,
    });
  }

  const productIds = [
    ...new Set(
      orders.flatMap((o) =>
        o.items.map((it) => mappings.get(it.marketplaceSku)?.productId).filter((id): id is string => !!id)
      )
    ),
  ];
  const hppMap = await effectiveHppMap(productIds);

  const existingRows = await prisma.order.findMany({
    where: { storeId, marketplaceOrderId: { in: orders.map((o) => o.marketplaceOrderId) } },
    select: { id: true, marketplaceOrderId: true, buyerName: true },
  });
  const existing = new Map(existingRows.map((e) => [e.marketplaceOrderId, e]));

  const ops = [];
  for (const o of orders) {
    const items = o.items.map((it) => {
      const m = mappings.get(it.marketplaceSku);
      if (!m?.productId) unmapped++;
      // Varian marketplace bisa "1 box (16 sachet)" atau "10 sachet" untuk
      // product DASAR yang sama → konversi ke satuan dasar pakai faktor mapping,
      // kalau tidak stok berkurang salah (1 box dihitung 1 sachet).
      const factor = Math.max(1, m?.baseQtyPerUnit ?? 1);
      return {
        productId: m?.productId ?? null,
        marketplaceSku: it.marketplaceSku,
        productName: it.productName,
        qty: it.qty,
        baseQty: it.qty * factor,
        price: it.price,
        subtotal: it.subtotal,
        // bekukan HPP per item (bundle = Σ isi). Belum ter-mapping → 0.
        hppSnapshot: m?.productId ? hppMap.get(m.productId) ?? 0 : 0,
      };
    });

    const hit = existing.get(o.marketplaceOrderId);
    if (hit) {
      ops.push(
        prisma.order.update({
          where: { id: hit.id },
          data: {
            status: o.status,
            buyerName: o.buyerName ?? hit.buyerName,
            totalAmount: o.totalAmount,
            marketplaceFee: o.marketplaceFee,
            shippingSubsidy: o.shippingSubsidy,
            netAmount: o.netAmount,
            ...(o.escrowAt ? { escrowAt: o.escrowAt } : {}),
          },
        })
      );
      updated++;
    } else {
      ops.push(
        prisma.order.create({
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
            escrowAt: o.escrowAt ?? null,
            items: { create: items },
          },
        })
      );
      created++;
    }
  }

  for (let i = 0; i < ops.length; i += WRITE_CHUNK) {
    await prisma.$transaction(ops.slice(i, i + WRITE_CHUNK));
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
