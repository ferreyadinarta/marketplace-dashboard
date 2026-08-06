"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { ImportedProduct } from "@/lib/adapters/types";
import { getShopeeCatalog } from "@/lib/shopee/sync";
import { getTiktokCatalog } from "@/lib/tiktok/sync";

// Import katalog product dari marketplace toko → Master Product.
// Dedup by SKU: product yang SKU-nya sudah ada TIDAK disentuh (lindungi HPP/harga
// yang diinput manual) — cuma di-link ke mapping. SKU baru → dibuat.
// Sekalian bikin/again ProductMapping biar order yang masuk otomatis ke-attribute.
export async function importStoreProducts(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return;

  let q: string;
  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new Error("Toko tidak ditemukan");

    let catalog: ImportedProduct[];
    if (store.marketplace === "SHOPEE") catalog = await getShopeeCatalog(storeId);
    else if (store.marketplace === "TIKTOK") catalog = await getTiktokCatalog(storeId);
    else throw new Error("Import hanya untuk toko Shopee/TikTok yang terhubung.");

    let noSku = 0;

    // Buang SKU kosong + duplikat dulu (katalog besar sering punya SKU sama).
    const bySku = new Map<string, ImportedProduct>();
    for (const p of catalog) {
      if (!p.sku) {
        noSku++;
        continue;
      }
      if (!bySku.has(p.sku)) bySku.set(p.sku, p);
    }
    const skus = [...bySku.keys()];

    // Kerjakan per potongan & secara BULK — jangan 2-3 query per product, toko
    // dengan ratusan/ribuan product akan kena timeout function.
    const CHUNK = 300;
    let created = 0;
    let existing = 0;

    for (let i = 0; i < skus.length; i += CHUNK) {
      const part = skus.slice(i, i + CHUNK);

      // 1. product yang sudah ada → sekali query
      const found = await prisma.product.findMany({
        where: { sku: { in: part } },
        select: { id: true, sku: true },
      });
      const idBySku = new Map(found.map((p) => [p.sku, p.id]));
      existing += found.length;

      // 2. product baru → sekali insert (SKU yang sudah ada tidak disentuh,
      //    supaya HPP/harga yang diinput manual aman)
      const toCreate = part
        .filter((s) => !idBySku.has(s))
        .map((s) => {
          const p = bySku.get(s)!;
          return { name: p.name, sku: s, priceRetail: p.price, hpp: 0, priceGrosir: 0, unit: "pcs" };
        });
      if (toCreate.length) {
        const rows = await prisma.product.createManyAndReturn({
          data: toCreate,
          select: { id: true, sku: true },
        });
        for (const r of rows) idBySku.set(r.sku, r.id);
        created += rows.length;
      }

      // 3. mapping (biar order marketplace otomatis ke product ini) → sekali query
      const maps = await prisma.productMapping.findMany({
        where: { storeId, marketplaceSku: { in: part } },
        select: { id: true, marketplaceSku: true, productId: true },
      });
      const mapBySku = new Map(maps.map((m) => [m.marketplaceSku, m]));

      const newMaps: { storeId: string; marketplaceSku: string; marketplaceProductName: string; productId: string }[] = [];
      for (const s of part) {
        const productId = idBySku.get(s);
        if (!productId) continue;
        const p = bySku.get(s)!;
        const ex = mapBySku.get(s);
        if (!ex) {
          newMaps.push({ storeId, marketplaceSku: s, marketplaceProductName: p.name, productId });
        } else if (ex.productId !== productId) {
          // hanya update kalau memang berubah
          await prisma.productMapping.update({
            where: { id: ex.id },
            data: { productId, marketplaceProductName: p.name },
          });
        }
      }
      if (newMaps.length) await prisma.productMapping.createMany({ data: newMaps, skipDuplicates: true });
    }

    q = `import=ok&created=${created}&existing=${existing}&nosku=${noSku}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    q = `import=error&reason=${encodeURIComponent(msg)}`;
  }

  revalidatePath("/master/product");
  revalidatePath("/master/toko");
  revalidatePath("/master/mapping");
  redirect(`/master/product?${q}`);
}
