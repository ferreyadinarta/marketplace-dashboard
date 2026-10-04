import type { Prisma, Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestOrders } from "@/lib/sync";
import type { ProgressFn } from "@/lib/syncProgress";
import { tanggal } from "@/lib/format";
import type { NormalizedOrder } from "@/lib/adapters/types";
import {
  fetchOrderItems,
  listSettlements,
  settlementItems,
  type BlibliCreds,
  type BlibliOrderItem,
  type BlibliSettlementItem,
} from "./client";

// Store: apiKey = Client ID, apiSecret = Client Key, accessToken = API Seller Key, shopIdApi = Store Code
export function blibliCreds(store: Store): BlibliCreds {
  if (!store.apiKey || !store.apiSecret || !store.accessToken || !store.shopIdApi || !store.apiUsername) {
    throw new Error(`Kredensial API Blibli toko "${store.name}" belum lengkap.`);
  }
  return {
    clientId: store.apiKey,
    clientKey: store.apiSecret,
    sellerKey: store.accessToken,
    storeCode: store.shopIdApi,
    username: store.apiUsername,
    signatureKey: store.apiSignatureKey,
  };
}

type Status = NormalizedOrder["status"];

function mapItemStatus(s: string): Status {
  switch ((s || "").toUpperCase()) {
    case "D":
    case "ES":
      return "COMPLETED";
    case "PU":
    case "PF":
    case "CX":
    case "BP":
    case "NCX":
      return "SHIPPED";
    case "X":
    case "OS":
      return "CANCELLED";
    case "DF":
    case "DC":
      return "RETURNED";
    default:
      return "PENDING"; // C, FP, CR
  }
}

const RANK: Record<string, number> = { PENDING: 0, SHIPPED: 1, COMPLETED: 2 };

// Blibli kirim per item → gabung per nomor order. Order baru Selesai kalau semua itemnya Selesai.
export function normalizeOrders(items: BlibliOrderItem[]): NormalizedOrder[] {
  const byItem = new Map(items.map((it) => [String(it.order.itemId), it]));
  const byOrder = new Map<string, BlibliOrderItem[]>();
  for (const it of byItem.values()) {
    const id = String(it.order.id);
    byOrder.set(id, [...(byOrder.get(id) ?? []), it]);
  }

  return [...byOrder].map(([id, list]) => {
    const withStatus = list.map((it) => ({ it, status: mapItemStatus(it.order.itemStatus) }));
    const active = withStatus.filter((x) => x.status !== "CANCELLED" && x.status !== "RETURNED" && x.it.order.quantity > 0);
    const status: Status = active.length
      ? active.reduce<Status>((a, x) => (RANK[x.status] < RANK[a] ? x.status : a), "COMPLETED")
      : withStatus.some((x) => x.status === "RETURNED")
        ? "RETURNED"
        : "CANCELLED";

    const lines = (active.length ? active : withStatus).map(({ it }) => {
      const price = Math.round(it.product.finalPrice || it.product.price || 0);
      const qty = Math.max(0, it.order.quantity ?? 0);
      return {
        marketplaceSku: it.product.sellerSku || it.product.blibliSku || "(tanpa SKU)",
        marketplaceItemId: String(it.order.itemId),
        productName: it.product.itemName || "(tanpa nama)",
        qty,
        price,
        subtotal: price * qty,
      };
    });
    const total = active.length ? lines.reduce((a, l) => a + l.subtotal, 0) : 0;

    return {
      marketplaceOrderId: id,
      orderDate: new Date(list[0].order.date),
      status,
      buyerName: list[0].order.customerFullName,
      totalAmount: total,
      marketplaceFee: 0, // diisi dari settlement
      shippingSubsidy: 0,
      netAmount: total,
      items: lines,
    };
  });
}

export type SyncResult = { created: number; updated: number; unmapped: number; partial: boolean };

const DAY = 24 * 3600 * 1000;
const WINDOW = 30 * DAY;
const MAX_HISTORY = 364 * DAY; // API Blibli cuma menyimpan 1 tahun
const INGEST_CHUNK = 50;

export async function syncBlibliStore(
  storeId: string,
  from: Date,
  to: Date,
  opts: { deadlineMs?: number; onProgress?: ProgressFn; resume?: boolean; preserveCursor?: boolean } = {}
): Promise<SyncResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  const creds = blibliCreds(store);

  const started = Date.now();
  const deadline = opts.deadlineMs ?? 45_000;
  const outOfTime = () => Date.now() - started > deadline;

  const fromMs = Math.max(from.getTime(), Date.now() - MAX_HISTORY);
  const toMs = to.getTime();
  const windows: [number, number][] = [];
  for (let end = toMs; end > fromMs; end -= WINDOW) windows.push([Math.max(fromMs, end - WINDOW), end]);

  const cursorMs = opts.resume && store.syncCursor ? store.syncCursor.getTime() : null;
  if (!opts.resume && !opts.preserveCursor && store.syncCursor) {
    await prisma.store.update({ where: { id: store.id }, data: { syncCursor: null } });
  }

  const total: SyncResult = { created: 0, updated: 0, unmapped: 0, partial: false };
  const progress = opts.onProgress;
  let ordersDone = 0;
  await progress?.({ phase: "orders", windowTotal: windows.length, windowIndex: 0, message: `Menarik order ${store.name}…` });

  for (const [wi, [ws, we]] of windows.entries()) {
    if (outOfTime()) {
      total.partial = true;
      break;
    }
    const label = `Penjualan ${tanggal(new Date(ws))} – ${tanggal(new Date(we))}`;
    await progress?.({ windowIndex: wi + 1, ordersDone, created: total.created, updated: total.updated, message: label });
    if (cursorMs != null && ws >= cursorMs) continue;

    const orders = normalizeOrders(await fetchOrderItems(creds, ws, we));

    // fee dari settlement jangan ditimpa 0 oleh data order list
    const settled = await prisma.order.findMany({
      where: { storeId: store.id, marketplaceOrderId: { in: orders.map((o) => o.marketplaceOrderId) }, feeDetailAt: { not: null } },
      select: { marketplaceOrderId: true, totalAmount: true, marketplaceFee: true, netAmount: true },
    });
    const keep = new Map(settled.map((s) => [s.marketplaceOrderId, s]));
    for (const o of orders) {
      const k = keep.get(o.marketplaceOrderId);
      if (k) Object.assign(o, { totalAmount: k.totalAmount, marketplaceFee: k.marketplaceFee, netAmount: k.netAmount });
    }

    for (let i = 0; i < orders.length; i += INGEST_CHUNK) {
      const r = await ingestOrders(store.id, orders.slice(i, i + INGEST_CHUNK));
      total.created += r.created;
      total.updated += r.updated;
      total.unmapped += r.unmapped;
    }
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

// ---------- Pencairan (settlement) ----------
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

type FeeDetail = { blibli: Record<string, BlibliSettlementItem & { settlementId: string }> };

// Rincian per order dari semua item yang sudah settle. Fee = penjualan − yang cair, jadi laba selalu cocok dengan uang masuk.
export function orderFees(detail: FeeDetail) {
  const items = Object.values(detail.blibli);
  const sales = Math.round(items.reduce((a, i) => a + n(i.sales), 0));
  const net = Math.round(items.reduce((a, i) => a + n(i.totalPayment), 0));
  const shipping = Math.round(items.reduce((a, i) => a + Math.abs(n(i.sellerShipping)), 0));
  const tax = Math.round(items.reduce((a, i) => a + Math.abs(n(i.pph23)), 0));
  const fee = Math.max(0, sales - net);
  return { sales, net, fee, shipping, tax, admin: Math.max(0, fee - shipping - tax) };
}

export async function syncBlibliPayouts(
  storeId: string,
  from: Date,
  to: Date,
  opts: { deadlineMs?: number } = {}
): Promise<{ payouts: number; orders: number; amount: number; unmatched: number; partial: boolean }> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  const creds = blibliCreds(store);
  const started = Date.now();
  const deadline = opts.deadlineMs ?? 40_000;

  const settlements = (await listSettlements(creds, Math.max(from.getTime(), Date.now() - MAX_HISTORY), to.getTime()))
    .filter((s) => s.settlementId && !s.paymentHold)
    .sort((a, b) => n(b.paymentDate) - n(a.paymentDate));

  // settlement yang sudah tercatat & sudah menempel ke order tidak perlu ditarik lagi
  const refs = settlements.map((s) => `BLIBLI-${s.settlementId}`);
  const done = await prisma.payout.findMany({
    where: { storeId, reference: { in: refs }, orders: { some: {} } },
    select: { reference: true },
  });
  const doneRefs = new Set(done.map((d) => d.reference));

  const out = { payouts: 0, orders: 0, amount: 0, unmatched: 0, partial: false };
  for (const s of settlements) {
    const reference = `BLIBLI-${s.settlementId}`;
    if (doneRefs.has(reference)) continue;
    if (Date.now() - started > deadline) {
      out.partial = true;
      break;
    }

    const items = await settlementItems(creds, s.settlementId);
    const amount = Math.round(n(s.totalPayment));
    const payoutDate = new Date(n(s.paymentDate) || Date.now());
    const existing = await prisma.payout.findFirst({ where: { storeId, reference }, select: { id: true } });
    const payout = existing
      ? await prisma.payout.update({ where: { id: existing.id }, data: { amount, payoutDate } })
      : await prisma.payout.create({ data: { storeId, reference, amount, payoutDate } });

    const rows = await prisma.orderItem.findMany({
      where: { marketplaceItemId: { in: items.map((i) => String(i.orderItemNo)) }, order: { storeId } },
      select: { marketplaceItemId: true, order: { select: { id: true, feeDetail: true } } },
    });
    const byItem = new Map(rows.map((r) => [r.marketplaceItemId!, r.order]));
    const touched = new Map<string, FeeDetail>();
    for (const it of items) {
      const order = byItem.get(String(it.orderItemNo));
      if (!order) {
        out.unmatched++;
        continue;
      }
      const prev = touched.get(order.id) ?? (order.feeDetail as FeeDetail | null);
      const detail: FeeDetail = { blibli: { ...(prev?.blibli ?? {}) } };
      detail.blibli[String(it.orderItemNo)] = { ...it, settlementId: s.settlementId };
      touched.set(order.id, detail);
    }

    const now = new Date();
    await prisma.$transaction(
      [...touched].map(([id, detail]) => {
        const f = orderFees(detail);
        return prisma.order.update({
          where: { id },
          data: {
            payoutId: payout.id,
            escrowAt: now,
            ...(f.sales > 0 ? { totalAmount: f.sales } : {}),
            netAmount: f.net,
            marketplaceFee: f.fee,
            feeAdmin: f.admin,
            feeShipping: f.shipping,
            feeTax: f.tax,
            feeDetail: detail as unknown as Prisma.InputJsonValue,
            feeDetailAt: now,
          },
        });
      })
    );
    out.payouts++;
    out.orders += touched.size;
    out.amount += amount;
  }
  return out;
}
