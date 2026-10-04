import type { Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestOrders } from "@/lib/sync";
import type { ProgressFn } from "@/lib/syncProgress";
import { dateKey, tanggal } from "@/lib/format";
import type { NormalizedOrder } from "@/lib/adapters/types";
import { getAppToken, listOrdersUpdated, type AkulakuOrder } from "./client";

// Token aplikasi ±2 jam → refresh (atau minta baru) kalau sisa < 10 menit
export async function ensureAkulakuToken(store: Store): Promise<string> {
  if (store.accessToken && store.tokenExpiresAt && store.tokenExpiresAt.getTime() > Date.now() + 10 * 60_000) {
    return store.accessToken;
  }
  let t;
  try {
    t = store.refreshToken ? await getAppToken(store.refreshToken) : await getAppToken();
  } catch {
    t = await getAppToken();
  }
  await prisma.store.update({
    where: { id: store.id },
    data: {
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      tokenExpiresAt: new Date(Date.now() + t.expiresIn * 1000),
    },
  });
  return t.accessToken;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
// "2023-01-06T08:00:14.000+0000"
const toDate = (s?: string | null) => (s ? new Date(s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")) : null);

function mapStatus(o: AkulakuOrder, total: number): NormalizedOrder["status"] {
  switch (o.orderStatus) {
    case 2:
      return "UNPAID";
    case 5:
      return "SHIPPED";
    case 6:
      return total > 0 && num(o.refundTotalAmount) >= total ? "RETURNED" : "COMPLETED";
    case -1:
      return "CANCELLED";
    default:
      return "PENDING"; // 3 menunggu diterima, 4 menunggu dikirim
  }
}

function itemSku(it: NonNullable<AkulakuOrder["orderItemList"]>[number]): string {
  return it.apiSkuId || it.goodsInfos?.[0]?.goodsNo || `AKL-${it.skuId}`;
}

function itemName(it: NonNullable<AkulakuOrder["orderItemList"]>[number]): string {
  let variant = "";
  try {
    variant = Object.values(JSON.parse(it.skuSpecValues || "{}") as Record<string, string>).join(" ");
  } catch {
    // spec bukan JSON
  }
  const base = it.skuName || "(tanpa nama)";
  return variant ? `${base} - ${variant}` : base;
}

export function normalizeOrder(o: AkulakuOrder): NormalizedOrder & { settledAt: Date | null } {
  const items = (o.orderItemList ?? []).map((it) => {
    const price = Math.round(num(it.skuSalePrice ?? it.skuPrice));
    const qty = Math.max(0, num(it.qty));
    return {
      marketplaceSku: itemSku(it),
      marketplaceItemId: String(it.id),
      productName: itemName(it),
      qty,
      price,
      subtotal: price * qty,
    };
  });
  const total = items.reduce((a, it) => a + it.subtotal, 0);
  const status = mapStatus(o, total);
  const settledAt = o.settlementAmount != null ? toDate(o.settlementTime) : null;

  // sudah cair: fee = penjualan − yang cair; belum: perkiraan dari incomeAmount
  const sale = status === "CANCELLED" ? 0 : total;
  const net = settledAt ? Math.round(num(o.settlementAmount)) : sale && num(o.incomeAmount) > 0 ? Math.round(num(o.incomeAmount)) : sale;
  const fee = Math.max(0, sale - net);
  const tax = Math.min(fee, Math.round(Math.abs(num(o.orderTaxAmount))));

  return {
    marketplaceOrderId: String(o.orderId),
    orderDate: toDate(o.createTime) ?? new Date(),
    status,
    buyerName: o.receiverAddress?.name,
    totalAmount: sale,
    marketplaceFee: fee,
    shippingSubsidy: 0,
    netAmount: net,
    ...(settledAt
      ? {
          escrowAt: settledAt,
          feeBreakdown: {
            admin: fee - tax,
            shipping: 0,
            tax,
            raw: {
              settlementAmount: o.settlementAmount,
              incomeAmount: o.incomeAmount,
              platformFee: o.platformFee,
              financialServiceFee: o.financialServiceFee,
              codServiceFee: o.codServiceFee,
              orderMarketingFee: o.orderMarketingFee,
              orderTaxAmount: o.orderTaxAmount,
              refundTotalAmount: o.refundTotalAmount,
            },
          },
        }
      : {}),
    items,
    settledAt,
  };
}

// Pencairan dikelompokkan per tanggal cair (WIB), sama seperti Shopee
async function linkPayouts(storeId: string, orders: ReturnType<typeof normalizeOrder>[]) {
  const byDate = new Map<string, string[]>();
  for (const o of orders) {
    if (!o.settledAt) continue;
    const key = dateKey(o.settledAt);
    byDate.set(key, [...(byDate.get(key) ?? []), o.marketplaceOrderId]);
  }
  for (const [key, ids] of byDate) {
    const reference = `AKULAKU-${key}`;
    const payoutDate = new Date(`${key}T12:00:00+07:00`);
    const existing = await prisma.payout.findFirst({ where: { storeId, reference }, select: { id: true } });
    const payout = existing ?? (await prisma.payout.create({ data: { storeId, reference, amount: 0, payoutDate } }));
    await prisma.order.updateMany({ where: { storeId, marketplaceOrderId: { in: ids } }, data: { payoutId: payout.id } });
    const sum = await prisma.order.aggregate({ where: { payoutId: payout.id }, _sum: { netAmount: true } });
    await prisma.payout.update({ where: { id: payout.id }, data: { amount: sum._sum.netAmount ?? 0, payoutDate } });
  }
}

export type SyncResult = { created: number; updated: number; unmapped: number; partial: boolean };

const DAY = 24 * 3600 * 1000;
const WINDOW = 15 * DAY;
const INGEST_CHUNK = 50;

export async function syncAkulakuStore(
  storeId: string,
  from: Date,
  to: Date,
  opts: { deadlineMs?: number; onProgress?: ProgressFn; resume?: boolean; preserveCursor?: boolean } = {}
): Promise<SyncResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store?.shopIdApi) throw new Error(`Toko Akulaku belum terhubung (authorize dulu).`);
  const token = await ensureAkulakuToken(store);

  const started = Date.now();
  const deadline = opts.deadlineMs ?? 45_000;
  const fromMs = from.getTime();
  const windows: [number, number][] = [];
  for (let end = to.getTime(); end > fromMs; end -= WINDOW) windows.push([Math.max(fromMs, end - WINDOW), end]);

  const cursorMs = opts.resume && store.syncCursor ? store.syncCursor.getTime() : null;
  if (!opts.resume && !opts.preserveCursor && store.syncCursor) {
    await prisma.store.update({ where: { id: store.id }, data: { syncCursor: null } });
  }

  const total: SyncResult = { created: 0, updated: 0, unmapped: 0, partial: false };
  const progress = opts.onProgress;
  let ordersDone = 0;
  await progress?.({ phase: "orders", windowTotal: windows.length, windowIndex: 0, message: `Menarik order ${store.name}…` });

  for (const [wi, [ws, we]] of windows.entries()) {
    if (Date.now() - started > deadline) {
      total.partial = true;
      break;
    }
    const label = `Penjualan ${tanggal(new Date(ws))} – ${tanggal(new Date(we))}`;
    await progress?.({ windowIndex: wi + 1, ordersDone, created: total.created, updated: total.updated, message: label });
    if (cursorMs != null && ws >= cursorMs) continue;

    const orders = (await listOrdersUpdated(token, store.shopIdApi, ws, we)).map(normalizeOrder);
    for (let i = 0; i < orders.length; i += INGEST_CHUNK) {
      const r = await ingestOrders(store.id, orders.slice(i, i + INGEST_CHUNK));
      total.created += r.created;
      total.updated += r.updated;
      total.unmapped += r.unmapped;
    }
    await linkPayouts(store.id, orders);
    ordersDone += orders.length;
    await progress?.({ ordersDone, ordersTotal: ordersDone, created: total.created, updated: total.updated, message: label });

    if (!opts.preserveCursor) {
      await prisma.store.update({ where: { id: store.id }, data: { syncCursor: new Date(ws) } });
    }
  }

  const syncedFrom = !total.partial && (!store.syncedFrom || from < store.syncedFrom) ? from : store.syncedFrom;
  await prisma.store.update({
    where: { id: store.id },
    data: { lastSyncAt: new Date(), syncedFrom, syncCursor: opts.preserveCursor || total.partial ? undefined : null },
  });
  return total;
}
