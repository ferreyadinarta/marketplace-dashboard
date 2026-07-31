import { prisma } from "./prisma";

// HPP efektif per product:
//   - bundle  → Σ (hpp component × qty isi)  (modal gabungan isinya)
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
      select: { bundleId: true, qty: true, component: { select: { hpp: true } } },
    });
    for (const c of comps) {
      sumByBundle.set(c.bundleId, (sumByBundle.get(c.bundleId) ?? 0) + c.qty * c.component.hpp);
    }
  }

  for (const p of products) out.set(p.id, p.isBundle ? sumByBundle.get(p.id) ?? 0 : p.hpp);
  return out;
}
