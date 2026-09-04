import { prisma } from "./prisma";
import { dateKey } from "./format";
import { modalOf } from "./units";

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
  const profit = omzet - fee - hpp;
  return { omzet, fee, hpp, profit, jumlahOrder: orders.length };
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
  return Array.from(map.entries()).map(([marketplace, v]) => ({ marketplace, ...v }));
}

// id semu untuk bucket product tanpa grup
export const NO_GROUP = "__none__";

type ProdLite = { id: string; name: string; sku: string; hpp: number };

// pembukuan dikelompokkan per grup, tiap baris = product.
// Product tanpa grup dikumpulkan di bucket "Tanpa Grup".
export async function getPembukuanByGroup(f: DashboardFilter) {
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
  for (const o of orders) {
    const feePerItem = o.items.length ? o.marketplaceFee / o.items.length : 0;
    for (const it of o.items) {
      if (!it.productId) continue;
      const r = perProduct.get(it.productId) ?? { terjual: 0, omzet: 0, fee: 0, hpp: 0 };
      r.terjual += itemBaseQty(it); // dalam satuan dasar (konsisten walau jual campur box/sachet)
      r.omzet += it.subtotal;
      r.fee += feePerItem;
      r.hpp += itemModal(it);
      perProduct.set(it.productId, r);
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
    if (ungrouped.length) result.push(buildGroup(NO_GROUP, "Tanpa Grup", ungrouped));
  }

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
export async function getOrdersDetail(f: DashboardFilter): Promise<LedgerRow[]> {
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
    const feePerItem = o.items.length ? o.marketplaceFee / o.items.length : 0;
    const shipPerItem = o.items.length ? o.shippingSubsidy / o.items.length : 0;
    for (const it of o.items) {
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
        groupName: it.product?.group?.name ?? "Tanpa Grup",
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
    const feePerItem = o.items.length ? o.marketplaceFee / o.items.length : 0;
    for (const it of o.items) {
      if (!it.productId || !it.product) continue;
      const r =
        map.get(it.productId) ??
        { productId: it.productId, name: it.product.name, sku: it.product.sku, qty: 0, omzet: 0, profit: 0 };
      r.qty += it.qty;
      r.omzet += it.subtotal;
      r.profit += it.subtotal - feePerItem - itemModal(it);
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
