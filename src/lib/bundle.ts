import { prisma } from "./prisma";
import { modalOf } from "./units";

// HPP efektif per product (semuanya PER SATUAN UTAMA):
//   - bundle  → Σ modal tiap isi (hpp isi per satuan utamanya, qty isi dalam
//               satuan dasar → dikonversi lewat modalOf)
//   - biasa   → product.hpp
// Dipakai saat membekukan hppSnapshot di penjualan (manual & marketplace) supaya
// profit bundle benar (bukan 0). Balikin Map<productId, hpp>.
export async function effectiveHppMap(productIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  const out = new Map<string, number>();
  if (ids.length === 0) return out;

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, hpp: true, isBundle: true },
  });

  const bundleIds = products.filter((p) => p.isBundle).map((p) => p.id);
  const sumByBundle = new Map<string, number>();
  if (bundleIds.length) {
    const comps = await prisma.productComponent.findMany({
      where: { bundleId: { in: bundleIds } },
      select: { bundleId: true, qty: true, component: { select: { hpp: true, packSize: true } } },
    });
    for (const c of comps) {
      const modal = modalOf(c.component.hpp, c.component.packSize, c.qty);
      sumByBundle.set(c.bundleId, (sumByBundle.get(c.bundleId) ?? 0) + modal);
    }
  }

  for (const p of products) out.set(p.id, p.isBundle ? Math.round(sumByBundle.get(p.id) ?? 0) : p.hpp);
  return out;
}
