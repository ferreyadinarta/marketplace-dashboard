import { prisma } from "./prisma";
import { effectiveHppMap } from "./bundle";

// `subtotal` = total harga baris itu (yang diketik user). Dipakai sebagai angka
// resmi kalau ada, supaya total tidak meleset karena pembagian per unit
// (mis. Rp 100.000 untuk 3 box → per unit 33.333, tapi totalnya tetap 100.000).
type ParsedItem = { productId: string; qty: number; price: number; unit?: string; subtotal?: number };

// Baca payload item multi-product dari form (`items` = JSON array),
// validasi + cocokkan ke product, kembalikan data OrderItem siap create.
// Dukung satuan besar (pack): kalau unit="pack" → baseQty = qty × packSize.
export async function buildItemsData(formData: FormData) {
  const raw = String(formData.get("items") ?? "[]");
  let parsed: ParsedItem[] = [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) parsed = arr;
  } catch {
    return [];
  }

  const items = parsed
    .map((x) => {
      const qty = Math.max(1, Math.floor(Number(x?.qty) || 0));
      const price = Math.max(0, Math.floor(Number(x?.price) || 0));
      const rawSub = Math.max(0, Math.floor(Number(x?.subtotal) || 0));
      return {
        productId: String(x?.productId ?? ""),
        qty,
        price,
        unit: x?.unit === "pack" ? "pack" : "base",
        subtotal: rawSub > 0 ? rawSub : price * qty,
      };
    })
    .filter((x) => x.productId && x.qty >= 1);
  if (items.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));
  const hppMap = await effectiveHppMap(products.map((p) => p.id)); // bundle → Σ isi

  return items
    .filter((i) => pmap.has(i.productId))
    .map((i) => {
      const p = pmap.get(i.productId)!;
      const isPack = i.unit === "pack" && p.packSize >= 2 && !!p.packUnit;
      const baseQty = isPack ? i.qty * p.packSize : i.qty;
      const unitLabel = isPack ? p.packUnit : p.unit;
      return {
        productId: p.id,
        marketplaceSku: p.sku,
        productName: p.name,
        qty: i.qty, // dalam satuan yang dijual (box atau sachet)
        unit: unitLabel, // label satuan jual
        baseQty, // untuk stok (satuan dasar)
        // price = per satuan jual (untuk tampilan), subtotal = angka resmi baris
        price: Math.round(i.subtotal / i.qty),
        subtotal: i.subtotal,
        hppSnapshot: hppMap.get(p.id) ?? p.hpp, // modal dibekukan (bundle = Σ isi)
      };
    });
}
