"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { ImportedProduct } from "@/lib/adapters/types";
import { getShopeeCatalog } from "@/lib/shopee/sync";
import { getTiktokCatalog } from "@/lib/tiktok/sync";
import { parseBaseQty } from "@/lib/suggestMapping";
import { getT } from "@/lib/i18n-server";

// Tarik katalog toko marketplace → siapkan daftar Mapping SKU.
// TIDAK membuat product: Master Product berisi product DASAR buatan user, dan
// beberapa varian marketplace bisa menunjuk ke satu product dasar yang sama.
// Sekalian bikin/again ProductMapping biar order yang masuk otomatis ke-attribute.
export async function importStoreProducts(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return;

  const { t } = await getT();

  let q: string;
  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new Error(t("Toko tidak ditemukan", "Store not found"));

    let catalog: ImportedProduct[];
    if (store.marketplace === "SHOPEE") catalog = await getShopeeCatalog(storeId);
    else if (store.marketplace === "TIKTOK") catalog = await getTiktokCatalog(storeId);
    else throw new Error(t("Import hanya untuk toko Shopee/TikTok yang terhubung.", "Import is only for connected Shopee/TikTok stores."));

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

    // Import TIDAK membuat product. Master Product = product DASAR yang dibuat
    // user sendiri (mis. "Flimty Fiber Blackcurrant"); satu product dasar bisa
    // punya banyak varian marketplace ("1 box 16 sachet", "10 sachet"). Import
    // hanya menyiapkan baris Mapping SKU + menebak isi per unit, lalu user yang
    // memilih product-nya di halaman Mapping SKU.
    // Product dipetakan otomatis HANYA kalau SKU-nya persis sama (aman).
    const CHUNK = 300;
    let created = 0;
    let existing = 0;

    for (let i = 0; i < skus.length; i += CHUNK) {
      const part = skus.slice(i, i + CHUNK);

      const found = await prisma.product.findMany({
        where: { sku: { in: part } },
        select: { id: true, sku: true },
      });
      const idBySku = new Map(found.map((p) => [p.sku, p.id]));

      const maps = await prisma.productMapping.findMany({
        where: { storeId, marketplaceSku: { in: part } },
        select: { id: true, marketplaceSku: true },
      });
      const known = new Set(maps.map((m) => m.marketplaceSku));
      existing += known.size;

      const newMaps = part
        .filter((s) => !known.has(s))
        .map((s) => {
          const p = bySku.get(s)!;
          return {
            storeId,
            marketplaceSku: s,
            marketplaceProductName: p.name,
            baseQtyPerUnit: parseBaseQty(p.name), // tebakan, bisa diubah user
            productId: idBySku.get(s) ?? null,
          };
        });
      if (newMaps.length) {
        await prisma.productMapping.createMany({ data: newMaps, skipDuplicates: true });
        created += newMaps.length;
      }
    }

    q = `import=ok&created=${created}&existing=${existing}&nosku=${noSku}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : t("tidak diketahui", "unknown");
    q = `import=error&reason=${encodeURIComponent(msg)}`;
  }

  revalidatePath("/master/product");
  revalidatePath("/master/toko");
  revalidatePath("/master/mapping");
  // hasil import muncul di Mapping SKU (di situ user memilih product dasarnya)
  redirect(`/master/mapping?${q}`);
}
