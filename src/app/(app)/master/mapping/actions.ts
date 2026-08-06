"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client"; // dipakai sebagai nilai juga (Prisma.join)
import { suggestProduct, parseBaseQty } from "@/lib/suggestMapping";

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

// Batas aman satu kali proses (Vercel maks 60 detik). Sisanya tinggal klik lagi.
const BULK_LIMIT = 3_000;

// Susun filter yang SAMA dengan halaman Mapping SKU, supaya "semua yang tampil"
// di tombol benar-benar berarti baris yang sedang tersaring.
// (tidak di-export: file "use server" hanya boleh mengekspor async function)
function mappingWhere(f: {
  q?: string;
  marketplace?: string;
  storeId?: string;
}): Prisma.ProductMappingWhereInput {
  const where: Prisma.ProductMappingWhereInput = {};
  if (f.storeId) where.storeId = f.storeId;
  if (f.marketplace) where.store = { marketplace: f.marketplace };
  if (f.q) {
    where.OR = [
      { marketplaceSku: { contains: f.q, mode: "insensitive" } },
      { marketplaceProductName: { contains: f.q, mode: "insensitive" } },
    ];
  }
  return where;
}

// Backfill order item untuk BANYAK mapping sekaligus — satu UPDATE join, bukan
// per baris. Tanpa ini, memetakan 1000 SKU berarti 2000 query dan pasti timeout.
async function backfillOrderItems(mappingIds: string[]) {
  const CHUNK = 500;
  for (let i = 0; i < mappingIds.length; i += CHUNK) {
    const part = mappingIds.slice(i, i + CHUNK);
    await prisma.$executeRaw`
      UPDATE "OrderItem" AS oi
      SET "productId" = pm."productId",
          "baseQty"   = oi."qty" * pm."baseQtyPerUnit"
      FROM "Order" AS o, "ProductMapping" AS pm
      WHERE oi."orderId" = o."id"
        AND pm."storeId" = o."storeId"
        AND pm."marketplaceSku" = oi."marketplaceSku"
        AND pm."id" IN (${Prisma.join(part)})
    `;
  }
}

// Petakan BANYAK SKU sekaligus untuk baris yang sedang tersaring & belum dipetakan.
//  • mode "suggest" → pakai saran otomatis per baris (yang tidak ada sarannya dilewati)
//  • mode "product" → semua diarahkan ke satu product yang dipilih user
// Isi per unit: "auto" = ditebak dari nama varian, atau angka tetap dari user.
// Baris yang SUDAH dipetakan tidak pernah disentuh.
export async function bulkAssignMappings(formData: FormData) {
  const mode = String(formData.get("mode") ?? "suggest") === "product" ? "product" : "suggest";
  const q = String(formData.get("q") ?? "");
  const marketplace = String(formData.get("marketplace") ?? "");
  const storeId = String(formData.get("storeId") ?? "");
  const targetProductId = String(formData.get("productId") ?? "");
  const baseQtyRaw = String(formData.get("baseQty") ?? "auto");

  const back = new URLSearchParams();
  if (q) back.set("q", q);
  if (marketplace) back.set("marketplace", marketplace);
  if (storeId) back.set("storeId", storeId);

  if (mode === "product" && !targetProductId) {
    back.set("bulk", "error");
    back.set("reason", "Product tujuan belum dipilih");
    redirect(`/master/mapping?${back}`);
  }

  const where = { ...mappingWhere({ q, marketplace, storeId }), productId: null };
  const rows = await prisma.productMapping.findMany({
    where,
    select: { id: true, marketplaceProductName: true, marketplaceSku: true },
    take: BULK_LIMIT,
  });

  const products = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });

  // kelompokkan jadi (productId + isi per unit) → satu updateMany per kelompok
  const groups = new Map<string, { productId: string; baseQty: number; ids: string[] }>();
  let skipped = 0;

  for (const r of rows) {
    const name = r.marketplaceProductName || r.marketplaceSku;
    let productId = targetProductId;
    let baseQty = 1;

    if (mode === "suggest") {
      const s = suggestProduct(name, products);
      if (!s) {
        skipped++;
        continue;
      }
      productId = s.productId;
      baseQty = s.baseQty;
    } else {
      baseQty = baseQtyRaw === "auto" ? parseBaseQty(name) : Math.floor(Number(baseQtyRaw) || 1);
    }
    baseQty = Math.min(500, Math.max(1, baseQty));

    const key = `${productId}|${baseQty}`;
    const g = groups.get(key) ?? { productId, baseQty, ids: [] };
    g.ids.push(r.id);
    groups.set(key, g);
  }

  const touched: string[] = [];
  for (const g of groups.values()) {
    await prisma.productMapping.updateMany({
      where: { id: { in: g.ids } },
      data: { productId: g.productId, baseQtyPerUnit: g.baseQty },
    });
    touched.push(...g.ids);
  }

  if (touched.length) await backfillOrderItems(touched);

  revalidatePath("/master/mapping");
  revalidatePath("/pembukuan");
  revalidatePath("/stok");
  revalidatePath("/");

  back.set("bulk", "ok");
  back.set("n", String(touched.length));
  if (skipped) back.set("skip", String(skipped));
  redirect(`/master/mapping?${back}`);
}
