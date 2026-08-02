"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// petakan satu baris mapping ke product internal, lalu backfill order item
// lama yang SKU-nya sama supaya pembukuan langsung ikut terisi.
export async function assignMapping(formData: FormData) {
  const mappingId = String(formData.get("mappingId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!mappingId) return;

  // pastikan mapping masih ada (jangan crash P2025 kalau keburu berubah)
  const mapping = await prisma.productMapping.findUnique({ where: { id: mappingId } });
  if (!mapping) return;
  await prisma.productMapping.update({
    where: { id: mappingId },
    data: { productId: productId || null },
  });

  // backfill: order item dengan storeId+sku sama yang belum ter-mapping
  await prisma.orderItem.updateMany({
    where: {
      productId: null,
      marketplaceSku: mapping.marketplaceSku,
      order: { storeId: mapping.storeId },
    },
    data: { productId: productId || null },
  });

  revalidatePath("/master/mapping");
  revalidatePath("/pembukuan");
}
