import { prisma } from "./prisma";

type ParsedItem = { productId: string; qty: number; price: number; unit?: string };

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
    .map((x) => ({
      productId: String(x?.productId ?? ""),
      qty: Math.max(1, Math.floor(Number(x?.qty) || 0)),
      price: Math.max(0, Math.floor(Number(x?.price) || 0)),
      unit: x?.unit === "pack" ? "pack" : "base",
    }))
    .filter((x) => x.productId && x.qty >= 1);
  if (items.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));

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
        price: i.price, // per satuan jual
        subtotal: i.price * i.qty,
        hppSnapshot: p.hpp, // modal per satuan DASAR, dibekukan
      };
    });
}
