"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Master pakai "box-first": satuan utama (besar) + satuan kecil (opsional) + isi.
// Stok tetap dihitung di satuan TERKECIL agar tidak pecahan → base = satuan kecil
// kalau ada, kalau tidak base = satuan utama.
function resolveUnits(formData: FormData): { unit: string; packUnit: string; packSize: number } {
  const mainUnit = String(formData.get("mainUnit") ?? "").trim() || "pcs";
  const smallUnit = String(formData.get("smallUnit") ?? "").trim();
  const isiRaw = Number(formData.get("isi") ?? 0);
  const isi = isNaN(isiRaw) || isiRaw < 0 ? 0 : Math.floor(isiRaw);
  const hasPack = !!smallUnit && isi >= 2 && smallUnit.toLowerCase() !== mainUnit.toLowerCase();
  return hasPack
    ? { unit: smallUnit, packUnit: mainUnit, packSize: isi }
    : { unit: mainUnit, packUnit: "", packSize: 0 };
}

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const hpp = Number(formData.get("hpp") ?? 0);
  const priceRetail = Number(formData.get("priceRetail") ?? 0);
  const priceGrosir = Number(formData.get("priceGrosir") ?? 0);
  const { unit, packUnit, packSize } = resolveUnits(formData);
  const groupId = String(formData.get("groupId") ?? "");
  if (!name || !sku) return;

  await prisma.product.create({
    data: {
      name,
      sku,
      hpp: isNaN(hpp) ? 0 : hpp,
      priceRetail: isNaN(priceRetail) ? 0 : priceRetail,
      priceGrosir: isNaN(priceGrosir) ? 0 : priceGrosir,
      unit,
      packUnit,
      packSize,
      groupId: groupId || null,
    },
  });
  revalidatePath("/master/product");
  revalidatePath("/stok");
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const hpp = Number(formData.get("hpp") ?? 0);
  const priceRetail = Number(formData.get("priceRetail") ?? 0);
  const priceGrosir = Number(formData.get("priceGrosir") ?? 0);
  const { unit, packUnit, packSize } = resolveUnits(formData);
  const groupId = String(formData.get("groupId") ?? "");
  if (!id) return;

  const data: {
    name?: string;
    sku?: string;
    hpp: number;
    priceRetail: number;
    priceGrosir: number;
    unit: string;
    packUnit: string;
    packSize: number;
    groupId: string | null;
  } = {
    hpp: isNaN(hpp) ? 0 : hpp,
    priceRetail: isNaN(priceRetail) ? 0 : priceRetail,
    priceGrosir: isNaN(priceGrosir) ? 0 : priceGrosir,
    unit,
    packUnit,
    packSize,
    groupId: groupId || null,
  };
  if (name) data.name = name;
  // SKU harus unik → hanya diubah kalau tidak bentrok dengan product lain
  if (sku) {
    const clash = await prisma.product.findFirst({ where: { sku, NOT: { id } } });
    if (!clash) data.sku = sku;
  }

  await prisma.product.update({ where: { id }, data });
  revalidatePath("/master/product");
  revalidatePath("/pembukuan");
  revalidatePath("/stok");
}

// Duplikat product (untuk buat SKU mirip cepat). SKU dibuat unik otomatis.
export async function duplicateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return;

  let sku = `${p.sku}-COPY`;
  let n = 2;
  while (await prisma.product.findUnique({ where: { sku } })) {
    sku = `${p.sku}-COPY${n++}`;
  }

  await prisma.product.create({
    data: {
      name: `${p.name} (copy)`,
      sku,
      hpp: p.hpp,
      priceRetail: p.priceRetail,
      priceGrosir: p.priceGrosir,
      unit: p.unit,
      packUnit: p.packUnit,
      packSize: p.packSize,
      minStock: p.minStock,
      groupId: p.groupId,
    },
  });
  revalidatePath("/master/product");
  revalidatePath("/stok");
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.product.delete({ where: { id } });
  revalidatePath("/master/product");
}

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  // cegah duplikat (nama grup unik, case-insensitive)
  const exists = await prisma.bookkeepingGroup.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (exists) return;
  await prisma.bookkeepingGroup.create({ data: { name } });
  revalidatePath("/master/product");
}

export async function deleteGroup(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // product di grup ini otomatis jadi "tanpa grup" (schema onDelete: SetNull)
  await prisma.bookkeepingGroup.delete({ where: { id } });
  revalidatePath("/master/product");
  revalidatePath("/pembukuan");
}

// Simpan HPP / harga retail / harga grosir banyak product sekaligus (bulk).
export async function saveBulkPrices(formData: FormData) {
  const raw = String(formData.get("prices") ?? "[]");
  let rows: { id: string; hpp?: number; retail?: number; grosir?: number }[] = [];
  try {
    rows = JSON.parse(raw);
  } catch {
    rows = [];
  }

  for (const r of rows) {
    if (!r.id) continue;
    await prisma.product.update({
      where: { id: r.id },
      data: {
        hpp: Math.max(0, Math.floor(r.hpp ?? 0)),
        priceRetail: Math.max(0, Math.floor(r.retail ?? 0)),
        priceGrosir: Math.max(0, Math.floor(r.grosir ?? 0)),
      },
    });
  }

  revalidatePath("/master/product");
}
