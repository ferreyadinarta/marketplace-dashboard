"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Master pakai "box-first": satuan utama (besar) + satuan kecil (opsional) + isi.
// Stok tetap dihitung di satuan TERKECIL agar tidak pecahan → base = satuan kecil
// kalau ada, kalau tidak base = satuan utama.
function resolveUnits(formData: FormData): {
  unit: string;
  packUnit: string;
  packSize: number;
  koliUnit: string;
  koliSize: number;
} {
  const mainUnit = String(formData.get("mainUnit") ?? "").trim() || "pcs";
  const smallUnit = String(formData.get("smallUnit") ?? "").trim();
  const isiRaw = Number(formData.get("isi") ?? 0);
  const isi = isNaN(isiRaw) || isiRaw < 0 ? 0 : Math.floor(isiRaw);
  const hasPack = !!smallUnit && isi >= 2 && smallUnit.toLowerCase() !== mainUnit.toLowerCase();
  const base = hasPack
    ? { unit: smallUnit, packUnit: mainUnit, packSize: isi }
    : { unit: mainUnit, packUnit: "", packSize: 0 };

  // Koli = satuan terbesar (isi dalam PACK). Hanya berlaku kalau ada pack tier.
  const koliUnit = String(formData.get("koliUnit") ?? "").trim();
  const isiKoliRaw = Number(formData.get("isiKoli") ?? 0);
  const isiKoli = isNaN(isiKoliRaw) || isiKoliRaw < 0 ? 0 : Math.floor(isiKoliRaw);
  const hasKoli =
    base.packSize > 0 &&
    !!koliUnit &&
    isiKoli >= 2 &&
    koliUnit.toLowerCase() !== base.packUnit.toLowerCase();

  return hasKoli
    ? { ...base, koliUnit, koliSize: isiKoli }
    : { ...base, koliUnit: "", koliSize: 0 };
}

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const hpp = Number(formData.get("hpp") ?? 0);
  const priceRetail = Number(formData.get("priceRetail") ?? 0);
  const priceGrosir = Number(formData.get("priceGrosir") ?? 0);
  const { unit, packUnit, packSize, koliUnit, koliSize } = resolveUnits(formData);
  const groupId = String(formData.get("groupId") ?? "");
  if (!name || !sku) return;

  // SKU harus unik → cek dulu, jangan sampai crash P2002
  const clash = await prisma.product.findUnique({ where: { sku } });
  if (clash) redirect(`/master/product?add=dupe&sku=${encodeURIComponent(sku)}`);

  // Mode bundle: product ini isinya product lain (mis. box mix 3 rasa).
  // HPP & satuan kecil/koli tidak dipakai — modalnya dihitung dari isinya dan
  // stok yang berkurang adalah stok tiap isi.
  const isBundle = formData.get("isBundle") === "true";
  const comps = isBundle ? parseComponents(formData.get("components")) : [];

  const product = await prisma.product.create({
    data: {
      name,
      sku,
      hpp: isBundle || isNaN(hpp) ? 0 : hpp,
      priceRetail: isNaN(priceRetail) ? 0 : priceRetail,
      priceGrosir: isNaN(priceGrosir) ? 0 : priceGrosir,
      unit,
      packUnit,
      packSize,
      koliUnit,
      koliSize,
      groupId: groupId || null,
      isBundle,
    },
  });

  if (isBundle && comps.length) {
    await prisma.productComponent.createMany({
      data: comps.map((c) => ({ bundleId: product.id, ...c })),
    });
  }

  revalidatePath("/master/product");
  revalidatePath("/stok");
  // TIDAK redirect: navigasi bikin halaman lompat ke atas padahal form-nya di
  // tengah. Cukup revalidate — daftar product ikut segar di tempat, form-nya
  // di-reset sendiri di klien (lihat AddProductForm).
}

// Baca daftar isi bundle dari form: buang yang kosong/duplikat, qty minimal 1.
function parseComponents(raw: FormDataEntryValue | null, selfId?: string) {
  let arr: unknown = [];
  try {
    arr = JSON.parse(String(raw ?? "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  const seen = new Set<string>();
  const out: { componentId: string; qty: number }[] = [];
  for (const c of arr) {
    const componentId = String((c as { componentId?: unknown })?.componentId ?? "");
    const qty = Math.max(1, Math.floor(Number((c as { qty?: unknown })?.qty) || 0));
    if (!componentId || componentId === selfId || seen.has(componentId)) continue;
    seen.add(componentId);
    out.push({ componentId, qty });
  }
  return out;
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const hpp = Number(formData.get("hpp") ?? 0);
  const priceRetail = Number(formData.get("priceRetail") ?? 0);
  const priceGrosir = Number(formData.get("priceGrosir") ?? 0);
  const { unit, packUnit, packSize, koliUnit, koliSize } = resolveUnits(formData);
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
    koliUnit: string;
    koliSize: number;
    groupId: string | null;
  } = {
    hpp: isNaN(hpp) ? 0 : hpp,
    priceRetail: isNaN(priceRetail) ? 0 : priceRetail,
    priceGrosir: isNaN(priceGrosir) ? 0 : priceGrosir,
    unit,
    packUnit,
    packSize,
    koliUnit,
    koliSize,
    groupId: groupId || null,
  };
  if (name) data.name = name;
  // SKU harus unik → hanya diubah kalau tidak bentrok dengan product lain
  if (sku) {
    const clash = await prisma.product.findFirst({ where: { sku, NOT: { id } } });
    if (!clash) data.sku = sku;
  }

  // updateMany → tidak crash (P2025) kalau product keburu dihapus di tab lain
  await prisma.product.updateMany({ where: { id }, data });
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
      koliUnit: p.koliUnit,
      koliSize: p.koliSize,
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
  // deleteMany → idempoten (klik hapus 2x / baris sudah terhapus tidak crash)
  await prisma.product.deleteMany({ where: { id } });
  revalidatePath("/master/product");
  revalidatePath("/stok");
}

// Hapus BANYAK product sekaligus — dipakai membersihkan product sampah hasil
// import lama (1 product per varian marketplace, nama panjang, HPP 0).
// Aman: order & mapping TIDAK ikut terhapus (onDelete: SetNull), hanya kehilangan
// kaitan ke product-nya dan bisa dipetakan ulang. Riwayat opname/restock product
// itu memang ikut terhapus (Cascade) — makanya UI memberi peringatan.
export async function deleteProducts(formData: FormData) {
  let ids: string[] = [];
  try {
    const arr = JSON.parse(String(formData.get("ids") ?? "[]"));
    if (Array.isArray(arr)) ids = arr.map((x) => String(x)).filter(Boolean);
  } catch {
    ids = [];
  }
  if (ids.length === 0) return;

  // deleteMany → idempoten, tidak crash kalau ada yang sudah terhapus
  const r = await prisma.product.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/master/product");
  revalidatePath("/master/mapping");
  revalidatePath("/stok");
  revalidatePath("/pembukuan");
  redirect(`/master/product?deleted=${r.count}`);
}

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  // cegah duplikat (nama grup unik, case-insensitive)
  const exists = await prisma.bookkeepingGroup.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (exists) return;
  try {
    await prisma.bookkeepingGroup.create({ data: { name } });
  } catch {
    // race: nama grup keburu dibuat submit lain → abaikan (bukan crash)
    return;
  }
  revalidatePath("/master/product");
}

export async function deleteGroup(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // product di grup ini otomatis jadi "tanpa grup" (schema onDelete: SetNull)
  await prisma.bookkeepingGroup.deleteMany({ where: { id } });
  revalidatePath("/master/product");
  revalidatePath("/pembukuan");
}

// Ubah field satuan mentah (mainUnit/smallUnit/isi/koliUnit/isiKoli) → kolom DB.
// Sama logikanya dengan resolveUnits, tapi baca dari objek row (bukan FormData).
function resolveUnitsFromRow(r: {
  mainUnit?: string;
  smallUnit?: string;
  isi?: string | number;
  koliUnit?: string;
  isiKoli?: string | number;
}): { unit: string; packUnit: string; packSize: number; koliUnit: string; koliSize: number } | null {
  // kalau tidak ada satu pun field satuan → jangan sentuh satuan (return null)
  const anyUnit = r.mainUnit !== undefined || r.smallUnit !== undefined || r.koliUnit !== undefined;
  if (!anyUnit) return null;

  const mainUnit = String(r.mainUnit ?? "").trim() || "pcs";
  const smallUnit = String(r.smallUnit ?? "").trim();
  const isiRaw = Number(r.isi ?? 0);
  const isi = isNaN(isiRaw) || isiRaw < 0 ? 0 : Math.floor(isiRaw);
  const hasPack = !!smallUnit && isi >= 2 && smallUnit.toLowerCase() !== mainUnit.toLowerCase();
  const base = hasPack
    ? { unit: smallUnit, packUnit: mainUnit, packSize: isi }
    : { unit: mainUnit, packUnit: "", packSize: 0 };

  const koliUnit = String(r.koliUnit ?? "").trim();
  const isiKoliRaw = Number(r.isiKoli ?? 0);
  const isiKoli = isNaN(isiKoliRaw) || isiKoliRaw < 0 ? 0 : Math.floor(isiKoliRaw);
  const hasKoli =
    base.packSize > 0 && !!koliUnit && isiKoli >= 2 && koliUnit.toLowerCase() !== base.packUnit.toLowerCase();

  return hasKoli ? { ...base, koliUnit, koliSize: isiKoli } : { ...base, koliUnit: "", koliSize: 0 };
}

// Simpan HPP / harga + satuan banyak product sekaligus (bulk).
export async function saveBulkPrices(formData: FormData) {
  const raw = String(formData.get("prices") ?? "[]");
  let rows: {
    id: string;
    hpp?: number;
    retail?: number;
    grosir?: number;
    mainUnit?: string;
    smallUnit?: string;
    isi?: string | number;
    koliUnit?: string;
    isiKoli?: string | number;
  }[] = [];
  try {
    rows = JSON.parse(raw);
  } catch {
    rows = [];
  }

  for (const r of rows) {
    if (!r.id) continue;
    const u = resolveUnitsFromRow(r);
    await prisma.product.update({
      where: { id: r.id },
      data: {
        hpp: Math.max(0, Math.floor(r.hpp ?? 0)),
        priceRetail: Math.max(0, Math.floor(r.retail ?? 0)),
        priceGrosir: Math.max(0, Math.floor(r.grosir ?? 0)),
        ...(u ?? {}),
      },
    });
  }

  revalidatePath("/master/product");
  revalidatePath("/stok");
}

// (updateBundle) — Simpan konfigurasi bundle: tandai isBundle + ganti isinya (ProductComponent).
export async function updateBundle(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const isBundle = formData.get("isBundle") === "true";
  let comps: { componentId: string; qty: number }[] = [];
  try {
    const arr = JSON.parse(String(formData.get("components") ?? "[]"));
    if (Array.isArray(arr)) {
      comps = arr.map((c) => ({
        componentId: String(c?.componentId ?? ""),
        qty: Math.max(1, Math.floor(Number(c?.qty) || 0)),
      }));
    }
  } catch {
    comps = [];
  }

  // buang isi kosong, diri sendiri, dan duplikat
  const seen = new Set<string>();
  comps = comps.filter((c) => {
    if (!c.componentId || c.componentId === id || seen.has(c.componentId)) return false;
    seen.add(c.componentId);
    return true;
  });

  await prisma.$transaction([
    prisma.product.update({ where: { id }, data: { isBundle } }),
    prisma.productComponent.deleteMany({ where: { bundleId: id } }),
    ...(isBundle && comps.length
      ? [prisma.productComponent.createMany({ data: comps.map((c) => ({ bundleId: id, ...c })) })]
      : []),
  ]);

  revalidatePath("/master/product");
  revalidatePath("/stok");
  revalidatePath("/pembukuan");
}
