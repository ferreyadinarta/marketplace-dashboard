"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Petakan satu baris mapping ke product DASAR + berapa satuan dasar per unit
// (mis. varian "1 box" = 16 sachet). Lalu backfill order item lama yang SKU-nya
// sama supaya pembukuan & stok langsung ikut benar.
export async function assignMapping(formData: FormData) {
  const mappingId = String(formData.get("mappingId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!mappingId) return;

  const rawQty = Number(formData.get("baseQtyPerUnit") ?? 1);
  const baseQtyPerUnit = Number.isFinite(rawQty) ? Math.min(500, Math.max(1, Math.floor(rawQty))) : 1;

  // pastikan mapping masih ada (jangan crash P2025 kalau keburu berubah)
  const mapping = await prisma.productMapping.findUnique({ where: { id: mappingId } });
  if (!mapping) return;

  await prisma.productMapping.update({
    where: { id: mappingId },
    data: { productId: productId || null, baseQtyPerUnit },
  });

  // backfill product untuk order item dengan storeId+sku yang sama
  await prisma.orderItem.updateMany({
    where: {
      marketplaceSku: mapping.marketplaceSku,
      order: { storeId: mapping.storeId },
    },
    data: { productId: productId || null },
  });

  // backfill jumlah dalam satuan dasar (baseQty = qty × faktor). Perlu SQL mentah
  // karena nilainya dihitung dari kolom lain.
  await prisma.$executeRaw`
    UPDATE "OrderItem" AS oi
    SET "baseQty" = oi."qty" * ${baseQtyPerUnit}
    FROM "Order" AS o
    WHERE oi."orderId" = o."id"
      AND o."storeId" = ${mapping.storeId}
      AND oi."marketplaceSku" = ${mapping.marketplaceSku}
  `;

  revalidatePath("/master/mapping");
  revalidatePath("/pembukuan");
  revalidatePath("/stok");
  revalidatePath("/");
}
