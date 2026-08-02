"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { computeCurrentStock } from "@/lib/stock";
import { eventDateFromInput } from "@/lib/format";

// Barang masuk (restock) — bisa BANYAK product sekaligus (satu tanggal + catatan).
// Tiap batch simpan harga beli (cost) → HPP product jadi RATA-RATA TERTIMBANG stok:
//   avgBaru = (stokLama×avgLama + qtyMasuk×cost) / (stokLama + qtyMasuk)
export async function restockProducts(formData: FormData) {
  const dateStr = String(formData.get("tanggal") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  let parsed: { productId: string; qty: number; cost: number; unit?: string }[] = [];
  try {
    const a = JSON.parse(String(formData.get("items") ?? "[]"));
    if (Array.isArray(a)) parsed = a;
  } catch {
    return;
  }
  const items = parsed
    .map((x) => ({
      productId: String(x?.productId ?? ""),
      qty: Math.max(1, Math.floor(Number(x?.qty) || 0)),
      cost: Math.max(0, Math.floor(Number(x?.cost) || 0)),
      unit: x?.unit === "koli" ? "koli" : x?.unit === "pack" ? "pack" : "base",
    }))
    .filter((x) => x.productId && x.qty >= 1);
  if (items.length === 0) return;

  const restockAt = eventDateFromInput(dateStr);

  // kelompokkan per product, simpan tiap batch (qty + cost + unit) terpisah
  const byProduct = new Map<string, { qty: number; cost: number; unit: string }[]>();
  for (const it of items) {
    const arr = byProduct.get(it.productId) ?? [];
    arr.push({ qty: it.qty, cost: it.cost, unit: it.unit });
    byProduct.set(it.productId, arr);
  }

  for (const [productId, batches] of byProduct) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) continue;
    const hasPack = product.packSize >= 2 && !!product.packUnit;
    const hasKoli = hasPack && product.koliSize >= 2 && !!product.koliUnit;

    let onHand = Math.max(0, await computeCurrentStock(productId)); // stok sebelum restock ini (satuan dasar)
    let avg = product.hpp;
    for (const b of batches) {
      // konversi ke satuan DASAR: koli = packSize×koliSize, pack = packSize, base = 1
      const factor =
        b.unit === "koli" && hasKoli
          ? product.packSize * product.koliSize
          : b.unit === "pack" && hasPack
            ? product.packSize
            : 1;
      const baseQty = b.qty * factor;
      const baseCost = b.cost > 0 ? (factor > 1 ? Math.round(b.cost / factor) : b.cost) : 0;

      await prisma.stockRestock.create({ data: { productId, qty: baseQty, cost: baseCost, note, restockAt } });
      const batchCost = baseCost > 0 ? baseCost : avg; // cost kosong → netral (pakai avg lama)
      const newQty = onHand + baseQty;
      avg = newQty > 0 ? Math.round((onHand * avg + baseQty * batchCost) / newQty) : batchCost;
      onHand = newQty;
    }
    await prisma.product.update({ where: { id: productId }, data: { hpp: avg } });
  }

  revalidatePath("/stok");
  revalidatePath("/master/product");
  revalidatePath("/pembukuan");
  revalidatePath("/");
}

// Stock opname → catat hitungan fisik + selisih terhadap stok sistem saat ini.
// Opname jadi anchor baru: stok berjalan dihitung dari sini.
export async function saveOpname(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const countedRaw = formData.get("countedQty");
  const unit = String(formData.get("unit") ?? "base");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!productId || countedRaw === null || String(countedRaw).trim() === "") return;

  const counted = Math.max(0, Math.floor(Number(countedRaw) || 0));
  const product = await prisma.product.findUnique({ where: { id: productId } });
  // konversi ke satuan dasar kalau dihitung per pack
  const factor = unit === "pack" && product && product.packSize >= 2 ? product.packSize : 1;
  const countedQty = counted * factor;

  const systemQty = await computeCurrentStock(productId);
  await prisma.stockOpname.create({
    data: { productId, countedQty, systemQty, note, opnameAt: new Date() },
  });
  revalidatePath("/stok");
}

// Opname massal: simpan hitungan fisik banyak product sekaligus.
export async function saveBulkOpname(formData: FormData) {
  let parsed: { productId: string; counted: number; unit?: string }[] = [];
  try {
    const a = JSON.parse(String(formData.get("items") ?? "[]"));
    if (Array.isArray(a)) parsed = a;
  } catch {
    return;
  }
  const items = parsed
    .map((x) => ({
      productId: String(x?.productId ?? ""),
      counted: Math.max(0, Math.floor(Number(x?.counted) || 0)),
      unit: x?.unit === "pack" ? "pack" : "base",
    }))
    .filter((x) => x.productId);
  if (items.length === 0) return;

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, packSize: true },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));

  const opnameAt = new Date();
  for (const it of items) {
    const p = pmap.get(it.productId);
    const factor = it.unit === "pack" && p && p.packSize >= 2 ? p.packSize : 1;
    const countedQty = it.counted * factor;
    const systemQty = await computeCurrentStock(it.productId);
    await prisma.stockOpname.create({
      data: { productId: it.productId, countedQty, systemQty, opnameAt },
    });
  }
  revalidatePath("/stok");
}

// Ubah ambang stok menipis (low-stock alert) per product.
export async function updateMinStock(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const minStock = Math.max(0, Math.floor(Number(formData.get("minStock") ?? 0) || 0));
  if (!productId) return;
  await prisma.product.updateMany({ where: { id: productId }, data: { minStock } });
  revalidatePath("/stok");
}
