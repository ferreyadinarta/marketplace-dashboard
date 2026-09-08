import { prisma } from "./prisma";

export type StockStatus = "OUT" | "LOW" | "OK" | "UNSET";

export type StockLevel = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  packUnit: string;
  packSize: number;
  koliUnit: string;
  koliSize: number;
  minStock: number;
  hasOpname: boolean;
  base: number; // jumlah fisik pada opname terakhir (anchor)
  anchorAt: Date | null; // waktu opname terakhir
  restockSince: number; // barang masuk setelah anchor
  soldSince: number; // penjualan COMPLETED setelah anchor
  current: number; // stok berjalan = base + restockSince − soldSince
  soldTotal: number; // total terjual (COMPLETED) sepanjang waktu, info
  status: StockStatus;
};

// Model stok "anchored": opname terakhir jadi titik nol; dari situ stok =
// hitungan fisik + barang masuk − penjualan COMPLETED yang terjadi SETELAH opname.
// Penjualan diturunkan dari OrderItem (sumber kebenaran), tidak disimpan ganda,
// jadi opname baru cukup me-reset anchor tanpa risiko double-count masa lalu.
// Barang SHIPPED sudah keluar gudang walau Shopee baru menandai COMPLETED
// beberapa hari kemudian — kalau nunggu COMPLETED, stok sistem lebih banyak
// daripada fisiknya dan opname selalu minus.
const SOLD_STATUS = { in: ["COMPLETED", "SHIPPED"] };

export async function getStockLevels(): Promise<StockLevel[]> {
  const [products, latestOpnames, restocks, saleItems, components] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    // opname terbaru per product (distinct ambil baris pertama sesuai orderBy)
    prisma.stockOpname.findMany({
      orderBy: [{ productId: "asc" }, { opnameAt: "desc" }],
      distinct: ["productId"],
    }),
    prisma.stockRestock.findMany({ select: { productId: true, qty: true, restockAt: true } }),
    prisma.orderItem.findMany({
      where: { productId: { not: null }, order: { status: SOLD_STATUS } },
      select: { productId: true, qty: true, baseQty: true, order: { select: { orderDate: true } } },
    }),
    prisma.productComponent.findMany({ select: { bundleId: true, componentId: true, qty: true } }),
  ]);

  // jumlah terjual dalam SATUAN DASAR (pakai baseQty; fallback qty untuk data lama)
  const soldBase = (s: { qty: number; baseQty: number }) => (s.baseQty > 0 ? s.baseQty : s.qty);

  // Peta isi bundle: bundleId → [{ componentId, qty }]
  const bundleMap = new Map<string, { componentId: string; qty: number }[]>();
  for (const c of components) {
    const arr = bundleMap.get(c.bundleId) ?? [];
    arr.push({ componentId: c.componentId, qty: c.qty });
    bundleMap.set(c.bundleId, arr);
  }

  // Expand penjualan: jual 1 bundle = jual (qty × isi) tiap component-nya.
  // Penjualan product biasa diteruskan apa adanya. Hasil: daftar penjualan yang
  // sudah diatribusikan ke product FISIK (bukan bundle).
  type Sale = { productId: string; base: number; orderDate: Date };
  const expanded: Sale[] = [];
  for (const s of saleItems) {
    if (!s.productId) continue;
    const comps = bundleMap.get(s.productId);
    const base = soldBase(s);
    if (comps) {
      for (const c of comps) expanded.push({ productId: c.componentId, base: base * c.qty, orderDate: s.order.orderDate });
    } else {
      expanded.push({ productId: s.productId, base, orderDate: s.order.orderDate });
    }
  }

  const opnameByProduct = new Map(latestOpnames.map((o) => [o.productId, o]));

  // Bundle tidak di-stok/opname sendiri → keluarkan dari daftar.
  return products.filter((p) => !p.isBundle).map((p) => {
    const op = opnameByProduct.get(p.id);
    const hasOpname = !!op;
    const anchorAt = op ? op.opnameAt : null;
    const base = op ? op.countedQty : 0;

    const saleForProduct = expanded.filter((s) => s.productId === p.id);
    const soldTotal = saleForProduct.reduce((a, s) => a + s.base, 0);

    // Barang masuk selalu dihitung. Kalau sudah pernah opname, hanya restock
    // SETELAH opname yang ditambah (yang sebelum opname sudah "terhitung" di angka fisik).
    const restockSince = restocks
      .filter((r) => r.productId === p.id && (!anchorAt || r.restockAt > anchorAt))
      .reduce((a, r) => a + r.qty, 0);
    // Penjualan baru mengurangi stok SETELAH ada opname pertama (titik acuan).
    // Sebelum opname, penjualan lama (mis. histori marketplace) tidak dikurangi
    // supaya stok tidak jadi minus tanpa hitungan awal.
    const soldSince = hasOpname
      ? saleForProduct.filter((s) => anchorAt && s.orderDate > anchorAt).reduce((a, s) => a + s.base, 0)
      : 0;

    const current = base + restockSince - soldSince;
    // "Belum ada data" hanya kalau benar-benar belum ada opname DAN belum ada barang masuk.
    const untouched = !hasOpname && restockSince === 0;

    let status: StockStatus;
    if (untouched) status = "UNSET";
    else if (current <= 0) status = "OUT";
    else if (current <= p.minStock) status = "LOW";
    else status = "OK";

    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      packUnit: p.packUnit,
      packSize: p.packSize,
      koliUnit: p.koliUnit,
      koliSize: p.koliSize,
      minStock: p.minStock,
      hasOpname,
      base,
      anchorAt,
      restockSince,
      soldSince,
      current,
      soldTotal,
      status,
    };
  });
}

// Stok sistem saat ini untuk 1 product — dipakai saat menyimpan opname
// agar bisa mencatat selisih (systemQty) terhadap hitungan fisik.
export async function computeCurrentStock(productId: string): Promise<number> {
  const [op, restocks, directItems, compOf] = await Promise.all([
    prisma.stockOpname.findFirst({ where: { productId }, orderBy: { opnameAt: "desc" } }),
    prisma.stockRestock.findMany({ where: { productId }, select: { qty: true, restockAt: true } }),
    prisma.orderItem.findMany({
      where: { productId, order: { status: SOLD_STATUS } },
      select: { qty: true, baseQty: true, order: { select: { orderDate: true } } },
    }),
    // bundle yang MEMAKAI product ini sebagai component
    prisma.productComponent.findMany({ where: { componentId: productId }, select: { bundleId: true, qty: true } }),
  ]);

  const soldBase = (s: { qty: number; baseQty: number }) => (s.baseQty > 0 ? s.baseQty : s.qty);
  const sales: { base: number; orderDate: Date }[] = directItems.map((s) => ({
    base: soldBase(s),
    orderDate: s.order.orderDate,
  }));

  // tambahkan penjualan bundle yang mengandung product ini (base × isi)
  if (compOf.length) {
    const qtyByBundle = new Map(compOf.map((c) => [c.bundleId, c.qty]));
    const bundleItems = await prisma.orderItem.findMany({
      where: { productId: { in: compOf.map((c) => c.bundleId) }, order: { status: SOLD_STATUS } },
      select: { productId: true, qty: true, baseQty: true, order: { select: { orderDate: true } } },
    });
    for (const s of bundleItems) {
      const mult = qtyByBundle.get(s.productId ?? "") ?? 0;
      sales.push({ base: soldBase(s) * mult, orderDate: s.order.orderDate });
    }
  }

  const anchorAt = op ? op.opnameAt : null;
  const base = op ? op.countedQty : 0;
  const restockSince = restocks
    .filter((r) => !anchorAt || r.restockAt > anchorAt)
    .reduce((a, r) => a + r.qty, 0);
  // penjualan dalam satuan DASAR. Sebelum opname pertama, penjualan lama tidak dikurangi.
  const soldSince = op ? sales.filter((s) => s.orderDate > anchorAt!).reduce((a, s) => a + s.base, 0) : 0;
  return base + restockSince - soldSince;
}
