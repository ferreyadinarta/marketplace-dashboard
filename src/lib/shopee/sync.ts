import type { Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestOrders } from "@/lib/sync";
import type { ProgressFn } from "@/lib/syncProgress";
import { dateKey, tanggal } from "@/lib/format";
import type { NormalizedOrder } from "@/lib/adapters/types";
import type { ImportedProduct } from "@/lib/adapters/types";
import {
  refreshAccessToken,
  getOrderSnList,
  getOrderDetails,
  getEscrowDetail,
  getEscrowDetailBatch,
  fetchShopeeCatalog,
  getEscrowList,
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
  if (up === "UNPAID") return "UNPAID";
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

// Escrow = 1 panggilan API PER ORDER. Kalau dijalankan berurutan, toko dengan
// ribuan order tidak akan selesai sebelum function timeout → jalankan paralel
// terbatas (jangan terlalu tinggi supaya tidak kena rate limit Shopee).
const ESCROW_CONCURRENCY = 10;
const ESCROW_BATCH = 50; // batas order_sn per panggilan batch
const ESCROW_BATCH_CONCURRENCY = 4;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export type CachedFee = { marketplaceFee: number; netAmount: number };

// Normalisasi + ambil fee escrow per order. Escrow di-skip untuk:
//  - UNPAID (belum dibayar → escrow pasti belum ada)
//  - order yang fee-nya SUDAH pernah diambil (dipakai lagi dari `cached`),
//    supaya sync ulang tidak memanggil ribuan API lagi.
// CANCELLED & RETURNED tetap dicek: Shopee sering masih memotong sebagian fee /
// ada penyesuaian refund, jadi butuh datanya biar pembukuan akurat.
// Escrow gagal → fee tetap 0, sync jalan terus.
async function normalizeWithFees(
  accessToken: string,
  shopId: string,
  details: ShopeeOrderDetail[],
  cached: Map<string, CachedFee> = new Map()
): Promise<NormalizedOrder[]> {
  const orders = details.map(normalize);
  const pending: { sn: string; idx: number }[] = [];

  details.forEach((o, idx) => {
    const hit = cached.get(o.order_sn);
    if (hit) {
      // pakai fee yang sudah tersimpan — JANGAN biarkan 0 menimpa data lama
      orders[idx].marketplaceFee = hit.marketplaceFee;
      orders[idx].netAmount = hit.netAmount;
      return;
    }
    if ((o.order_status || "").toUpperCase() !== "UNPAID") pending.push({ sn: o.order_sn, idx });
  });

  const apply = (idx: number, inc: ShopeeIncome) => {
    orders[idx].escrowAt = new Date();
    orders[idx].marketplaceFee = feeFromIncome(inc);
    if (inc.escrow_amount != null && Number.isFinite(inc.escrow_amount)) {
      orders[idx].netAmount = Math.round(inc.escrow_amount);
    }
  };

  // Coba versi batch dulu (50 order/panggilan). Kalau endpointnya tidak bisa
  // dipakai app ini, `batch` null → sisanya ditarik satuan seperti sebelumnya.
  const leftovers: typeof pending = [];
  const slices: (typeof pending)[] = [];
  for (let i = 0; i < pending.length; i += ESCROW_BATCH) slices.push(pending.slice(i, i + ESCROW_BATCH));

  await mapLimit(slices, ESCROW_BATCH_CONCURRENCY, async (slice) => {
    const got = await getEscrowDetailBatch(accessToken, shopId, slice.map((x) => x.sn));
    if (!got) {
      leftovers.push(...slice);
      return;
    }
    for (const item of slice) {
      const inc = got.get(item.sn);
      if (inc) apply(item.idx, inc);
      else leftovers.push(item);
    }
  });

  await mapLimit(leftovers, ESCROW_CONCURRENCY, async ({ sn, idx }) => {
    const inc = await getEscrowDetail(accessToken, shopId, sn);
    if (inc) apply(idx, inc);
  });

  return orders;
}

export type SyncResult = { created: number; updated: number; unmapped: number; partial: boolean };

// Status yang TIDAK akan berubah lagi → kalau sudah tersimpan lengkap, batch-nya
// boleh dilewati total (tanpa panggil API) saat sync diulang.
const FINAL_STATUS = ["COMPLETED", "CANCELLED", "RETURNED"];

// Sync satu toko Shopee: refresh token kalau perlu → ambil order → normalisasi → simpan.
//
// Toko besar tidak mungkin selesai dalam 1 request (Vercel Hobby maks 60 detik),
// jadi:
//  1. berhenti SENDIRI sebelum kena timeout (deadlineMs) → balikin partial=true,
//     bukan crash/504;
//  2. simpan tiap batch, jadi progres tidak pernah hilang;
//  3. mulai dari periode TERBARU (yang paling penting masuk duluan);
//  4. batch yang ordernya sudah final & lengkap dilewati → klik Sync lagi cepat
//     melanjutkan sisanya.
export async function syncShopeeStore(
  storeId: string,
  from: Date,
  to: Date,
  opts: { deadlineMs?: number; onProgress?: ProgressFn; resume?: boolean; preserveCursor?: boolean } = {}
): Promise<SyncResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  const accessToken = await ensureFreshToken(store);
  const shopId = store.shopIdApi!;

  const started = Date.now();
  const deadline = opts.deadlineMs ?? 45_000; // sisakan headroom dari batas 60s
  const outOfTime = () => Date.now() - started > deadline;

  // Shopee batasi window get_order_list ≤ 15 hari → pecah, lalu balik urutannya
  // supaya periode terbaru diproses lebih dulu.
  const WINDOW = 15 * 24 * 3600;
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  const windows: [number, number][] = [];
  for (let start = fromSec; start < toSec; start += WINDOW) {
    windows.push([start, Math.min(start + WINDOW, toSec)]);
  }
  windows.reverse();

  // Periode LAMA yang sudah pernah tersync penuh tidak perlu dipindai lagi:
  // order di situ statusnya sudah final. Yang masih mungkin berubah (order baru,
  // status berubah, retur) hanya RECHECK_DAYS terakhir → itu selalu dipindai.
  // Lanjutan putaran sebelumnya: periode yang lebih baru dari cursor sudah
  // beres, jangan dilist ulang. Tanpa ini tiap putaran mengulang dari periode 1,
  // kehabisan waktu di tengah, dan tidak pernah maju (loop selamanya).
  const cursorSec =
    opts.resume && store.syncCursor ? Math.floor(store.syncCursor.getTime() / 1000) : null;
  // sync baru (bukan lanjutan) → buang cursor lama, jangan sampai putaran
  // berikutnya melewati periode terbaru yang belum sempat dikerjakan
  // preserveCursor: penyegaran harian jalan berdampingan dengan sync riwayat yang
  // belum selesai → bookmark riwayatnya jangan dihapus/ditimpa
  if (!opts.resume && !opts.preserveCursor && store.syncCursor) {
    await prisma.store.update({ where: { id: store.id }, data: { syncCursor: null } });
  }

  const RECHECK_DAYS = 30;
  const recheckCutoff = Math.floor(Date.now() / 1000) - RECHECK_DAYS * 24 * 3600;
  const syncedFromSec = store.syncedFrom ? Math.floor(store.syncedFrom.getTime() / 1000) : null;
  const alreadyCovered = (ws: number, we: number) =>
    syncedFromSec != null && we < recheckCutoff && ws >= syncedFromSec;

  const BATCH = 50; // batas get_order_detail per panggilan
  const total: SyncResult = { created: 0, updated: 0, unmapped: 0, partial: false };
  const progress = opts.onProgress;
  let ordersDone = 0; // order yang sudah dipindai (untuk tampilan progres)
  let ordersTotal = 0; // order yang sudah ketahuan ada; tumbuh tiap periode dilist

  await progress?.({
    phase: "orders",
    windowTotal: windows.length,
    windowIndex: 0,
    message: `Menarik order ${store.name}…`,
  });

  for (const [wi, [ws, we]] of windows.entries()) {
    if (outOfTime()) {
      total.partial = true;
      break;
    }
    await progress?.({
      windowIndex: wi + 1,
      ordersDone,
      created: total.created,
      updated: total.updated,
      message: `Penjualan ${tanggal(new Date(ws * 1000))} – ${tanggal(new Date(we * 1000))}`,
    });
    if (alreadyCovered(ws, we)) continue; // sudah final → 0 panggilan API
    if (cursorSec != null && ws >= cursorSec) continue; // sudah dikerjakan putaran sebelumnya
    const sns = await getOrderSnList(accessToken, shopId, ws, we);
    ordersTotal += sns.length;
    await progress?.({ ordersTotal });

    for (let i = 0; i < sns.length; i += BATCH) {
      if (outOfTime()) {
        total.partial = true;
        break;
      }
      const chunk = sns.slice(i, i + BATCH);

      // escrowAt, bukan fee > 0: order final yang feenya memang 0 (batal, atau
      // escrow balikin 0) jangan ikut ditarik ulang tiap putaran
      const known = await prisma.order.findMany({
        where: { storeId: store.id, marketplaceOrderId: { in: chunk }, escrowAt: { not: null } },
        select: {
          marketplaceOrderId: true,
          marketplaceFee: true,
          netAmount: true,
          status: true,
          orderDate: true,
        },
      });

      // Dicek per order, bukan per chunk: 1 order belum final jangan menyeret 49
      // lainnya. Order final yang MASIH BARU tetap ditarik ulang — retur/refund
      // bisa terjadi setelah Selesai, dan kalau dilewati stok & omzetnya tidak
      // pernah dikoreksi.
      const done = new Set(
        known
          .filter(
            (k) =>
              FINAL_STATUS.includes(k.status) &&
              Math.floor(k.orderDate.getTime() / 1000) < recheckCutoff
          )
          .map((k) => k.marketplaceOrderId)
      );
      const todo = chunk.filter((sn) => !done.has(sn));
      if (todo.length === 0) {
        ordersDone += chunk.length;
        continue;
      }
      ordersDone += chunk.length - todo.length;

      const cached = new Map<string, CachedFee>(
        known
          .filter((k) => FINAL_STATUS.includes(k.status))
          .map((k) => [k.marketplaceOrderId, { marketplaceFee: k.marketplaceFee, netAmount: k.netAmount }])
      );

      const details = await getOrderDetails(accessToken, shopId, todo);
      const normalized = await normalizeWithFees(accessToken, shopId, details, cached);
      const r = await ingestOrders(store.id, normalized);
      total.created += r.created;
      total.updated += r.updated;
      total.unmapped += r.unmapped;
      ordersDone += todo.length;

      await progress?.({
        ordersDone,
        ordersTotal,
        created: total.created,
        updated: total.updated,
        message: `Penjualan ${tanggal(new Date(ws * 1000))} – ${tanggal(new Date(we * 1000))}`,
      });
    }
    if (total.partial) break;
    if (!opts.preserveCursor) {
      await prisma.store.update({ where: { id: store.id }, data: { syncCursor: new Date(ws * 1000) } });
    }
  }

  // Catat sampai kapan riwayat sudah tersync PENUH. Hanya kalau tidak partial —
  // kalau terputus, jangan mengaku sudah lengkap.
  const syncedFrom =
    !total.partial && (!store.syncedFrom || from < store.syncedFrom) ? from : store.syncedFrom;

  await prisma.store.update({
    where: { id: store.id },
    // rentang tuntas → cursor dikosongkan biar sync berikutnya mulai dari terbaru
    data: {
      lastSyncAt: new Date(),
      syncedFrom,
      syncCursor: opts.preserveCursor || total.partial ? undefined : null,
    },
  });
  return total;
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

// ---------- Pencairan dana (Rekonsiliasi) ----------
// Shopee tidak mengirim "batch pencairan" untuk seller lokal; yang tersedia
// adalah waktu RILIS escrow per order (get_escrow_list). Jadi pencairan disusun
// sendiri: order yang rilis di HARI yang sama (WIB) digabung jadi satu Payout,
// lalu tiap order ditandai masuk pencairan itu (Order.payoutId).
//
// Idempoten: dijalankan ulang akan menimpa jumlahnya, bukan menambah baris baru.
export async function syncShopeePayouts(
  storeId: string,
  from: Date,
  to: Date,
  opts: { deadlineMs?: number } = {}
): Promise<{ payouts: number; orders: number; amount: number; unmatched: number }> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Toko tidak ditemukan");
  const accessToken = await ensureFreshToken(store);
  const shopId = store.shopIdApi!;

  const list = await getEscrowList(
    accessToken,
    shopId,
    Math.floor(from.getTime() / 1000),
    Math.floor(to.getTime() / 1000),
    { deadlineMs: opts.deadlineMs }
  );
  if (list.length === 0) return { payouts: 0, orders: 0, amount: 0, unmatched: 0 };

  // kelompokkan per TANGGAL RILIS (WIB) — itu yang dilihat user di mutasi bank
  const byDate = new Map<string, { amount: number; orderSns: string[] }>();
  for (const e of list) {
    const released = new Date(e.escrow_release_time * 1000);
    const key = dateKey(released);
    const g = byDate.get(key) ?? { amount: 0, orderSns: [] };
    g.amount += Math.round(e.payout_amount || 0);
    g.orderSns.push(e.order_sn);
    byDate.set(key, g);
  }

  let orders = 0;
  let amount = 0;
  // order_sn yang dananya sudah cair tapi ordernya BELUM ada di database
  // (biasanya karena rentang sync order lebih pendek dari rentang pencairan)
  let unmatched = 0;
  for (const [key, g] of byDate) {
    const reference = `ESCROW-${key}`;
    // tanggal disimpan di tengah hari WIB supaya tidak geser saat dibaca ulang
    const payoutDate = new Date(`${key}T12:00:00+07:00`);

    const existing = await prisma.payout.findFirst({ where: { storeId, reference } });
    const payout = existing
      ? await prisma.payout.update({
          where: { id: existing.id },
          data: { amount: g.amount, payoutDate },
        })
      : await prisma.payout.create({
          data: { storeId, reference, amount: g.amount, payoutDate },
        });

    const r = await prisma.order.updateMany({
      where: { storeId, marketplaceOrderId: { in: g.orderSns } },
      data: { payoutId: payout.id },
    });
    orders += r.count;
    unmatched += g.orderSns.length - r.count;
    amount += g.amount;
  }

  return { payouts: byDate.size, orders, amount, unmatched };
}
