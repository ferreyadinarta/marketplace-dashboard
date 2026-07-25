import { prisma } from "./prisma";

export type DashboardFilter = {
  from?: Date;
  to?: Date;
  marketplace?: string; // SHOPEE | TIKTOK | TOKOPEDIA
  storeId?: string;
  groupId?: string; // filter grup pembukuan (khusus halaman Pembukuan)
};

// bangun where clause order dari filter, hanya order tidak batal/retur
function orderWhere(f: DashboardFilter) {
  const where: Record<string, unknown> = {
    status: { in: ["PENDING", "SHIPPED", "COMPLETED"] },
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
      hpp += (it.product?.hpp ?? 0) * it.qty;
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
    const key = o.orderDate.toISOString().slice(0, 10);
    const cur = map.get(key) ?? { omzet: 0, profit: 0 };
    let hpp = 0;
    for (const it of o.items) hpp += (it.product?.hpp ?? 0) * it.qty;
    cur.omzet += o.totalAmount;
    cur.profit += o.totalAmount - o.marketplaceFee - hpp;
    map.set(key, cur);
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
    for (const it of o.items) hpp += (it.product?.hpp ?? 0) * it.qty;
    cur.omzet += o.totalAmount;
    cur.profit += o.totalAmount - o.marketplaceFee - hpp;
    cur.order += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([marketplace, v]) => ({ marketplace, ...v }));
}

// pembukuan dikelompokkan per grup, tiap baris = product
export async function getPembukuanByGroup(f: DashboardFilter) {
  const groups = await prisma.bookkeepingGroup.findMany({
    where: f.groupId ? { id: f.groupId } : undefined,
    include: { products: true },
    orderBy: { name: "asc" },
  });
  const orders = await prisma.order.findMany({
    where: orderWhere(f),
    include: { items: { include: { product: true } } },
  });

  // akumulasi per productId
  type Row = { productId: string; terjual: number; omzet: number; fee: number; hpp: number };
  const perProduct = new Map<string, Row>();
  for (const o of orders) {
    const feePerItem = o.items.length ? o.marketplaceFee / o.items.length : 0;
    for (const it of o.items) {
      if (!it.productId) continue;
      const r =
        perProduct.get(it.productId) ??
        { productId: it.productId, terjual: 0, omzet: 0, fee: 0, hpp: 0 };
      r.terjual += it.qty;
      r.omzet += it.subtotal;
      r.fee += feePerItem;
      r.hpp += (it.product?.hpp ?? 0) * it.qty;
      perProduct.set(it.productId, r);
    }
  }

  return groups.map((g) => {
    const rows = g.products.map((p) => {
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
    return { groupId: g.id, groupName: g.name, rows, subtotal };
  });
}

export async function getStores() {
  return prisma.store.findMany({ orderBy: { name: "asc" } });
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
      r.profit += it.subtotal - feePerItem - it.product.hpp * it.qty;
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
