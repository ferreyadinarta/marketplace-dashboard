import { prisma } from "./prisma";
import { dateKey } from "./format";
import { modalOf } from "./units";
import { makeT, type T } from "./i18n";

// HPP (modal) per SATUAN UTAMA: pakai snapshot yang dibekukan saat jual; kalau 0
// (data lama / order marketplace) fallback ke HPP product saat ini.
function itemHpp(it: { hppSnapshot?: number | null; product?: { hpp: number } | null }): number {
  return it.hppSnapshot && it.hppSnapshot > 0 ? it.hppSnapshot : it.product?.hpp ?? 0;
}

// Modal total item ini. HPP per satuan utama (mis. per box) sedangkan baseQty
// dalam satuan dasar (mis. sachet) → dibagi isi per box dulu.
function itemModal(it: {
  hppSnapshot?: number | null;
  baseQty?: number | null;
  qty: number;
  product?: { hpp: number; packSize?: number } | null;
}): number {
  return modalOf(itemHpp(it), it.product?.packSize ?? 0, itemBaseQty(it));
}

// Jumlah dalam SATUAN DASAR (untuk hitung modal/terjual konsisten). Pakai baseQty;
// kalau 0 (data lama) fallback ke qty.
function itemBaseQty(it: { baseQty?: number | null; qty: number }): number {
  return it.baseQty && it.baseQty > 0 ? it.baseQty : it.qty;
}

// Porsi item terhadap ordernya, untuk membagi fee/subsidi. Kalau nilai ordernya
// 0 (mis. habis kena voucher) dibagi rata — jangan sampai feenya menguap.
function shareOf(subtotal: number, nilai: number, jumlahItem: number): number {
  if (nilai > 0) return subtotal / nilai;
  return jumlahItem > 0 ? 1 / jumlahItem : 0;
}

export type DashboardFilter = {
  from?: Date;
  to?: Date;
  marketplace?: string; // SHOPEE | TIKTOK | TOKOPEDIA
  storeId?: string;
  groupId?: string; // filter grup pembukuan (khusus halaman Pembukuan)
};

// bangun where clause order dari filter.
// HANYA hitung order yang SELESAI (COMPLETED) = penjualan benar-benar terjadi &
// dana cair. Otomatis mengecualikan yang batal/retur (CANCELLED/RETURNED) —
// termasuk paket yang sudah dikirim tapi akhirnya dibatalkan/dikembalikan —
// dan yang belum final (PENDING/SHIPPED), supaya pembukuan tidak over-hitung.
function orderWhere(f: DashboardFilter) {
  const where: Record<string, unknown> = {
    status: "COMPLETED",
  };
  if (f.from || f.to) {
    where.orderDate = {
      ...(f.from ? { gte: f.from } : {}),
      ...(f.to ? { lte: f.to } : {}),
    };
  }
  const store: Record<string, unknown> = {};
  if (f.marketplace) store.marketplace = f.marketplace;
  if (f.storeId) where.storeId = f.storeId;
  if (Object.keys(store).length) where.store = store;
  return where;
}

// ringkasan profit keseluruhan
export async function getSummary(f: DashboardFilter) {
  const orders = await prisma.order.findMany({
    where: orderWhere(f),
    include: { items: { include: { product: true } } },
  });

  let omzet = 0;
  let fee = 0;
  let hpp = 0;
  for (const o of orders) {
    omzet += o.totalAmount;
    fee += o.marketplaceFee;
    for (const it of o.items) {
      hpp += itemModal(it);
    }
  }
  const hppBulat = Math.round(hpp);
  return { omzet, fee, hpp: hppBulat, profit: omzet - fee - hppBulat, jumlahOrder: orders.length };
}

// Pesanan yang SUDAH masuk tapi belum Selesai (PENDING/SHIPPED). Sengaja
// dipisah dari pembukuan: feenya belum final dan masih bisa batal, jadi angka
// ini cuma untuk "hari ini ada penjualan apa", bukan untuk profit resmi.
export async function getInFlight(f: DashboardFilter) {
  const where: Record<string, unknown> = { status: { in: ["PENDING", "SHIPPED"] } };
  if (f.from || f.to) {
    where.orderDate = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  }
  if (f.storeId) where.storeId = f.storeId;
  if (f.marketplace) where.store = { marketplace: f.marketplace };

  // Acuan perkiraan: toko/marketplace yang SAMA dengan filter, 90 hari terakhir.
  // Kalau diambil global & sepanjang masa, angkanya bukan cerminan toko itu.
  const acuan: Record<string, unknown> = { status: "COMPLETED", marketplaceFee: { gt: 0 } };
  if (f.storeId) acuan.storeId = f.storeId;
  if (f.marketplace) acuan.store = { marketplace: f.marketplace };
  acuan.orderDate = { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) };

  const batal: Record<string, unknown> = { status: { in: ["CANCELLED", "RETURNED"] } };
  const selesai: Record<string, unknown> = { status: "COMPLETED" };
  for (const w of [batal, selesai]) {
    if (f.storeId) w.storeId = f.storeId;
    if (f.marketplace) w.store = { marketplace: f.marketplace };
    w.orderDate = { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) };
  }

  const [agg, settled, nBatal, nSelesai] = await Promise.all([
    prisma.order.aggregate({ where, _count: true, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: acuan, _count: true, _sum: { totalAmount: true, marketplaceFee: true } }),
    prisma.order.count({ where: batal }),
    prisma.order.count({ where: selesai }),
  ]);

  const omzet = agg._sum.totalAmount ?? 0;
  const dasar = settled._sum.totalAmount ?? 0;
  const feeRate = dasar > 0 ? (settled._sum.marketplaceFee ?? 0) / dasar : 0;
  const totalRiwayat = nBatal + nSelesai;
  const batalRate = totalRiwayat > 0 ? nBatal / totalRiwayat : 0;

  return {
    jumlahOrder: agg._count,
    omzet,
    feeRate,
    perkiraanFee: Math.round(omzet * feeRate),
    sampel: settled._count, // berapa order jadi dasar perkiraan
    batalRate,
    // perkiraan yang benar-benar masuk: dikurangi yang biasanya batal & fee
    perkiraanBersih: Math.round(omzet * (1 - batalRate) * (1 - feeRate)),
  };
}

// tren harian omzet & profit
export async function getDailyTrend(f: DashboardFilter) {
  const orders = await prisma.order.findMany({
    where: orderWhere(f),
    include: { items: { include: { product: true } } },
    orderBy: { orderDate: "asc" },
  });

  const map = new Map<string, { omzet: number; profit: number }>();
  for (const o of orders) {
    const key = dateKey(o.orderDate); // dikelompokkan per hari WIB, bukan UTC
    const cur = map.get(key) ?? { omzet: 0, profit: 0 };
    let hpp = 0;
    for (const it of o.items) hpp += itemModal(it);
    cur.omzet += o.totalAmount;
    cur.profit += o.totalAmount - o.marketplaceFee - hpp;
    map.set(key, cur);
  }
  // Isi hari kosong dengan 0 sepanjang rentang filter. Tanpa ini grafik mulai di
  // hari pertama yang ADA ordernya, jadi periode tanpa data terlihat seolah tidak
  // pernah difilter — padahal artinya belum tersync / memang tidak ada penjualan.
  if (f.from && f.to) {
    const out: { tanggal: string; omzet: number; profit: number }[] = [];
    const cursor = new Date(`${dateKey(f.from)}T00:00:00+07:00`);
    const last = dateKey(f.to);
    for (let i = 0; i < 1500; i++) {
      const key = dateKey(cursor);
      out.push({ tanggal: key, ...(map.get(key) ?? { omzet: 0, profit: 0 }) });
      if (key >= last) break;
      cursor.setTime(cursor.getTime() + 24 * 3600 * 1000);
    }
    return out;
  }

  return Array.from(map.entries()).map(([tanggal, v]) => ({ tanggal, ...v }));
}

// performa per marketplace
export async function getByMarketplace(f: DashboardFilter) {
  const orders = await prisma.order.findMany({
    where: orderWhere(f),
    include: { items: { include: { product: true } }, store: true },
  });
  const map = new Map<string, { omzet: number; profit: number; order: number }>();
  for (const o of orders) {
    const key = o.store.marketplace;
    const cur = map.get(key) ?? { omzet: 0, profit: 0, order: 0 };
    let hpp = 0;
    for (const it of o.items) hpp += itemModal(it);
    cur.omzet += o.totalAmount;
    cur.profit += o.totalAmount - o.marketplaceFee - hpp;
    cur.order += 1;
    map.set(key, cur);
  }
  // Pembulatan per baris bisa bikin jumlah baris ≠ total dashboard (selisih
  // 1-2 rupiah). Sisa pembulatan ditempelkan ke baris terbesar supaya
  // penjumlahannya persis sama.
  const rows = Array.from(map.entries()).map(([marketplace, v]) => ({
    marketplace,
    ...v,
    profit: Math.round(v.profit),
  }));
  const totalProfit = Math.round(
    Array.from(map.values()).reduce((a, v) => a + v.profit, 0)
  );
  const sisa = totalProfit - rows.reduce((a, r) => a + r.profit, 0);
  if (sisa !== 0 && rows.length) {
    const idx = rows.reduce((bi, r, i) => (Math.abs(r.profit) > Math.abs(rows[bi].profit) ? i : bi), 0);
    rows[idx].profit += sisa;
  }
  return rows;
}

// id semu untuk bucket product tanpa grup
export const NO_GROUP = "__none__";

type ProdLite = { id: string; name: string; sku: string; hpp: number };

// pembukuan dikelompokkan per grup, tiap baris = product.
// Product tanpa grup dikumpulkan di bucket "Tanpa Grup".
// t opsional (default id) — pemanggil di luar scope agent ini belum lewatkan bahasa.
export async function getPembukuanByGroup(f: DashboardFilter, t: T = makeT("id")) {
  const onlyNone = f.groupId === NO_GROUP;
  const groups = onlyNone
    ? []
    : await prisma.bookkeepingGroup.findMany({
        where: f.groupId ? { id: f.groupId } : undefined,
        include: { products: true },
        orderBy: { name: "asc" },
      });

  const orders = await prisma.order.findMany({
    where: orderWhere(f),
    include: { items: { include: { product: true } } },
  });

  // akumulasi per productId
  type Agg = { terjual: number; omzet: number; fee: number; hpp: number };
  const perProduct = new Map<string, Agg>();
  // Item yang SKU-nya belum dipetakan tidak punya product → tidak bisa masuk
  // baris grup, tapi omzet & feenya tetap dihitung supaya total pembukuan sama
  // dengan dashboard.
  const unmapped = { terjual: 0, omzet: 0, fee: 0, hpp: 0 };
  for (const o of orders) {
    // fee dibagi menurut NILAI item, bukan rata per item: 1 order isi barang
    // Rp 500rb + Rp 20rb tidak menanggung potongan yang sama
    const nilai = o.items.reduce((a, it) => a + it.subtotal, 0);
    for (const it of o.items) {
      const feeItem = o.marketplaceFee * shareOf(it.subtotal, nilai, o.items.length);
      const target = it.productId
        ? perProduct.get(it.productId) ?? { terjual: 0, omzet: 0, fee: 0, hpp: 0 }
        : unmapped;
      target.terjual += itemBaseQty(it); // satuan dasar (konsisten walau campur box/sachet)
      target.omzet += it.subtotal;
      target.fee += feeItem;
      target.hpp += itemModal(it);
      if (it.productId) perProduct.set(it.productId, target);
    }
  }

  const buildGroup = (groupId: string, groupName: string, products: ProdLite[]) => {
    const rows = products.map((p) => {
      const r = perProduct.get(p.id) ?? { terjual: 0, omzet: 0, fee: 0, hpp: 0 };
      const profit = r.omzet - r.fee - r.hpp;
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        hpp: p.hpp,
        terjual: r.terjual,
        omzet: r.omzet,
        fee: Math.round(r.fee),
        profit: Math.round(profit),
      };
    });
    const subtotal = rows.reduce(
      (acc, r) => ({
        terjual: acc.terjual + r.terjual,
        omzet: acc.omzet + r.omzet,
        fee: acc.fee + r.fee,
        profit: acc.profit + r.profit,
      }),
      { terjual: 0, omzet: 0, fee: 0, profit: 0 }
    );
    return { groupId, groupName, rows, subtotal };
  };

  const result = groups.map((g) => buildGroup(g.id, g.name, g.products));

  // bucket "Tanpa Grup" — tampil saat tanpa filter grup, atau filter = __none__
  if (!f.groupId || onlyNone) {
    const ungrouped = await prisma.product.findMany({
      where: { groupId: null },
      orderBy: { name: "asc" },
    });
    if (ungrouped.length) result.push(buildGroup(NO_GROUP, t("Tanpa Grup", "No group"), ungrouped));
  }

  // Sisa pembulatan per baris ditempel ke baris terbesar supaya jumlah semua
  // grup persis sama dengan total di Dashboard (jangan beda 1-2 rupiah).
  const rapikan = () => {
    const exactFee = [...perProduct.values()].reduce((a, v) => a + v.fee, 0) + unmapped.fee;
    const exactProfit =
      [...perProduct.values()].reduce((a, v) => a + (v.omzet - v.fee - v.hpp), 0) +
      (unmapped.omzet - unmapped.fee - unmapped.hpp);
    const rows = result.flatMap((g) => g.rows);
    if (!rows.length) return;
    const sisaFee = Math.round(exactFee) - rows.reduce((a, x) => a + x.fee, 0);
    const sisaProfit = Math.round(exactProfit) - rows.reduce((a, x) => a + x.profit, 0);
    const biggest = (key: "fee" | "profit") =>
      rows.reduce((bi, x, i) => (Math.abs(x[key]) > Math.abs(rows[bi][key]) ? i : bi), 0);
    if (sisaFee) rows[biggest("fee")].fee += sisaFee;
    if (sisaProfit) rows[biggest("profit")].profit += sisaProfit;
    for (const g of result) {
      g.subtotal.fee = g.rows.reduce((a, x) => a + x.fee, 0);
      g.subtotal.profit = g.rows.reduce((a, x) => a + x.profit, 0);
    }
  };

  if (!f.groupId && unmapped.omzet > 0) {
    const profit = unmapped.omzet - unmapped.fee - unmapped.hpp;
    result.push({
      groupId: "__unmapped__",
      groupName: t("SKU belum dipetakan", "Unmapped SKU"),
      rows: [
        {
          productId: "__unmapped__",
          name: t("SKU belum dipetakan", "Unmapped SKU"),
          sku: "—",
          hpp: 0,
          terjual: unmapped.terjual,
          omzet: unmapped.omzet,
          fee: Math.round(unmapped.fee),
          profit: Math.round(profit),
        },
      ],
      subtotal: {
        terjual: unmapped.terjual,
        omzet: unmapped.omzet,
        fee: Math.round(unmapped.fee),
        profit: Math.round(profit),
      },
    });
  }

  rapikan();
  return result;
}

export async function getStores() {
  return prisma.store.findMany({ orderBy: { name: "asc" } });
}

export type LedgerRow = {
  orderDate: Date;
  buyerName: string;
  marketplace: string;
  storeName: string;
  groupName: string; // brand / grup pembukuan (atau "Tanpa Grup")
  sku: string; // kolom "Order" di format kakak
  productName: string;
  qty: number; // dalam satuan saat dijual
  unit: string; // label satuan jual (ex: box / sachet)
  price: number;
  fee: number; // ongkir/adm (fee proporsional per item)
  total: number; // net per item (omzet - fee + subsidi ongkir)
  modal: number; // HPP x qty (untuk hitung laba)
};

// Ledger per-order untuk sheet ledger per brand. Satu baris = satu item order.
// Hanya order selesai (via orderWhere). Menghormati filter grup (brand).
// t opsional (default id) — pemanggil di luar scope agent ini belum lewatkan bahasa.
export async function getOrdersDetail(f: DashboardFilter, t: T = makeT("id")): Promise<LedgerRow[]> {
  const orders = await prisma.order.findMany({
    where: orderWhere(f),
    include: {
      store: true,
      items: { include: { product: { include: { group: true } } } },
    },
    orderBy: [{ orderDate: "asc" }, { createdAt: "asc" }],
  });

  const rows: LedgerRow[] = [];
  for (const o of orders) {
    // sama seperti Pembukuan: dibagi menurut nilai item, bukan rata per item
    const nilai = o.items.reduce((a, x) => a + x.subtotal, 0);
    for (const it of o.items) {
      const bagian = shareOf(it.subtotal, nilai, o.items.length);
      const feePerItem = o.marketplaceFee * bagian;
      const shipPerItem = o.shippingSubsidy * bagian;
      const gId = it.product?.groupId ?? null;
      // hormati filter grup
      if (f.groupId === NO_GROUP) {
        if (gId !== null) continue;
      } else if (f.groupId) {
        if (gId !== f.groupId) continue;
      }
      rows.push({
        orderDate: o.orderDate,
        buyerName: o.buyerName ?? "-",
        marketplace: o.store.marketplace,
        storeName: o.store.name,
        groupName: it.product?.group?.name ?? t("Tanpa Grup", "No group"),
        sku: it.product?.sku ?? it.marketplaceSku,
        productName: it.productName,
        qty: it.qty,
        unit: it.unit || it.product?.unit || "",
        price: it.price,
        fee: Math.round(feePerItem),
        total: Math.round(it.subtotal - feePerItem + shipPerItem),
        modal: Math.round(itemModal(it)),
      });
    }
  }
  return rows;
}

export async function getGroups() {
  return prisma.bookkeepingGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// product terlaris (top N) berdasarkan profit dalam periode filter
export async function getBestSellers(f: DashboardFilter, limit = 5) {
  const orders = await prisma.order.findMany({
    where: orderWhere(f),
    include: { items: { include: { product: true } } },
  });

  type Row = { productId: string; name: string; sku: string; qty: number; omzet: number; profit: number };
  const map = new Map<string, Row>();
  for (const o of orders) {
    const nilai = o.items.reduce((a, it) => a + it.subtotal, 0);
    for (const it of o.items) {
      if (!it.productId || !it.product) continue;
      // fee & satuan mengikuti aturan yang sama dengan Pembukuan biar angkanya cocok
      const feeItem = o.marketplaceFee * shareOf(it.subtotal, nilai, o.items.length);
      const r =
        map.get(it.productId) ??
        { productId: it.productId, name: it.product.name, sku: it.product.sku, qty: 0, omzet: 0, profit: 0 };
      r.qty += itemBaseQty(it);
      r.omzet += it.subtotal;
      r.profit += it.subtotal - feeItem - itemModal(it);
      map.set(it.productId, r);
    }
  }
  return Array.from(map.values())
    .map((r) => ({ ...r, profit: Math.round(r.profit) }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit);
}

// hitung periode sebelumnya dengan panjang sama, tepat sebelum [from, to]
export function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from: prevFrom, to: prevTo };
}
