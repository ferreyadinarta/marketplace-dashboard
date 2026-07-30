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

    let created = 0;
    let existing = 0;
    let noSku = 0;

    for (const p of catalog) {
      if (!p.sku) {
        noSku++;
        continue;
      }

      let product = await prisma.product.findUnique({ where: { sku: p.sku } });
      if (product) {
        existing++; // sudah ada → jangan timpa data manual
      } else {
        product = await prisma.product.create({
          data: { name: p.name, sku: p.sku, priceRetail: p.price, hpp: 0, priceGrosir: 0, unit: "pcs" },
        });
        created++;
      }

      // link mapping (biar order marketplace otomatis ke product ini)
      await prisma.productMapping.upsert({
        where: { storeId_marketplaceSku: { storeId, marketplaceSku: p.sku } },
        create: { storeId, marketplaceSku: p.sku, marketplaceProductName: p.name, productId: product.id },
        update: { productId: product.id, marketplaceProductName: p.name },
      });
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
