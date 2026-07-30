import { prisma } from "./prisma";

export type StockStatus = "OUT" | "LOW" | "OK" | "UNSET";

export type StockLevel = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  packUnit: string;
  packSize: number;
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
export async function getStockLevels(): Promise<StockLevel[]> {
  const [products, latestOpnames, restocks, saleItems] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    // opname terbaru per product (distinct ambil baris pertama sesuai orderBy)
    prisma.stockOpname.findMany({
      orderBy: [{ productId: "asc" }, { opnameAt: "desc" }],
      distinct: ["productId"],
    }),
    prisma.stockRestock.findMany({ select: { productId: true, qty: true, restockAt: true } }),
    prisma.orderItem.findMany({
      where: { productId: { not: null }, order: { status: "COMPLETED" } },
      select: { productId: true, qty: true, baseQty: true, order: { select: { orderDate: true } } },
    }),
  ]);

  // jumlah terjual dalam SATUAN DASAR (pakai baseQty; fallback qty untuk data lama)
  const soldBase = (s: { qty: number; baseQty: number }) => (s.baseQty > 0 ? s.baseQty : s.qty);
  const opnameByProduct = new Map(latestOpnames.map((o) => [o.productId, o]));

  return products.map((p) => {
    const op = opnameByProduct.get(p.id);
    const hasOpname = !!op;
    const anchorAt = op ? op.opnameAt : null;
    const base = op ? op.countedQty : 0;

    const saleForProduct = saleItems.filter((s) => s.productId === p.id);
    const soldTotal = saleForProduct.reduce((a, s) => a + soldBase(s), 0);

    // Barang masuk selalu dihitung. Kalau sudah pernah opname, hanya restock
    // SETELAH opname yang ditambah (yang sebelum opname sudah "terhitung" di angka fisik).
    const restockSince = restocks
      .filter((r) => r.productId === p.id && (!anchorAt || r.restockAt > anchorAt))
      .reduce((a, r) => a + r.qty, 0);
    // Penjualan baru mengurangi stok SETELAH ada opname pertama (titik acuan).
    // Sebelum opname, penjualan lama (mis. histori marketplace) tidak dikurangi
    // supaya stok tidak jadi minus tanpa hitungan awal.
    const soldSince = hasOpname
      ? saleForProduct.filter((s) => anchorAt && s.order.orderDate > anchorAt).reduce((a, s) => a + soldBase(s), 0)
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
  const [op, restocks, saleItems] = await Promise.all([
    prisma.stockOpname.findFirst({ where: { productId }, orderBy: { opnameAt: "desc" } }),
    prisma.stockRestock.findMany({ where: { productId }, select: { qty: true, restockAt: true } }),
    prisma.orderItem.findMany({
      where: { productId, order: { status: "COMPLETED" } },
      select: { qty: true, baseQty: true, order: { select: { orderDate: true } } },
    }),
  ]);
  const anchorAt = op ? op.opnameAt : null;
  const base = op ? op.countedQty : 0;
  const restockSince = restocks
    .filter((r) => !anchorAt || r.restockAt > anchorAt)
    .reduce((a, r) => a + r.qty, 0);
  // penjualan dalam satuan DASAR (baseQty; fallback qty). Sebelum opname pertama,
  // penjualan lama tidak dikurangi (lihat getStockLevels).
  const soldSince = op
    ? saleItems
        .filter((s) => s.order.orderDate > anchorAt!)
        .reduce((a, s) => a + (s.baseQty > 0 ? s.baseQty : s.qty), 0)
    : 0;
  return base + restockSince - soldSince;
}
