"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { buildItemsData } from "@/lib/sales";
import { eventDateFromInput } from "@/lib/format";

// Tambah toko konsinyasi (tempat titip jual).
export async function createKonsinyasiStore(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  // cegah toko/reseller duplikat (case-insensitive)
  const exists = await prisma.store.findFirst({
    where: { marketplace: "KONSINYASI", name: { equals: name, mode: "insensitive" } },
  });
  if (exists) return;
  await prisma.store.create({ data: { name, marketplace: "KONSINYASI" } });
  revalidatePath("/konsinyasi");
}

// Hapus toko / reseller. Cascade: penjualan toko ini ikut terhapus (schema onDelete: Cascade).
export async function deleteKonsinyasiStore(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.store.deleteMany({ where: { id } });
  revalidatePath("/konsinyasi");
  revalidatePath("/pembukuan");
  revalidatePath("/stok");
  revalidatePath("/");
}

// Catat satu penjualan grosir/reseller (jual putus) → jadi order.
// Bisa BANYAK product dalam 1 order (1 toko + 1 tanggal).
// Toko beli putus di depan: tidak ada komisi, omzet = Σ(harga grosir × qty).
// Masuk pembukuan, dashboard, dan stok (order COMPLETED).
export async function createKonsinyasiSale(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const tanggalStr = String(formData.get("tanggal") ?? "");
  const buyerName = String(formData.get("buyerName") ?? "").trim() || null;
  if (!storeId) return;

  const itemsData = await buildItemsData(formData);
  if (itemsData.length === 0) return;

  const orderDate = eventDateFromInput(tanggalStr);
  const total = itemsData.reduce((a, x) => a + x.subtotal, 0);
  const ref = `GROSIR-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  await prisma.order.create({
    data: {
      storeId,
      marketplaceOrderId: ref,
      orderDate,
      status: "COMPLETED",
      buyerName,
      totalAmount: total,
      marketplaceFee: 0, // jual putus: tidak ada komisi
      shippingSubsidy: 0,
      netAmount: total,
      items: { create: itemsData },
    },
  });

  revalidatePath("/konsinyasi");
  revalidatePath("/pembukuan");
  revalidatePath("/stok");
  revalidatePath("/");
}

export async function deleteKonsinyasiSale(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.order.deleteMany({ where: { id } });
  revalidatePath("/konsinyasi");
  revalidatePath("/pembukuan");
  revalidatePath("/stok");
  revalidatePath("/");
}
