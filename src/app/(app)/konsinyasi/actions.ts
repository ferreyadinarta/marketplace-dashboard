"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Tambah toko konsinyasi (tempat titip jual).
export async function createKonsinyasiStore(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.store.create({ data: { name, marketplace: "KONSINYASI" } });
  revalidatePath("/konsinyasi");
}

// Catat satu penjualan konsinyasi → jadi order (masuk pembukuan & dashboard).
export async function createKonsinyasiSale(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const qty = Math.max(1, Number(formData.get("qty") ?? 0) || 0);
  const price = Math.max(0, Number(formData.get("price") ?? 0) || 0);
  const komisi = Math.max(0, Number(formData.get("komisi") ?? 0) || 0);
  const tanggalStr = String(formData.get("tanggal") ?? "");
  const buyerName = String(formData.get("buyerName") ?? "").trim() || null;
  if (!storeId || !productId || qty < 1) return;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const orderDate = tanggalStr ? new Date(`${tanggalStr}T00:00:00`) : new Date();
  const subtotal = price * qty;
  const ref = `KONS-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  await prisma.order.create({
    data: {
      storeId,
      marketplaceOrderId: ref,
      orderDate,
      status: "COMPLETED",
      buyerName,
      totalAmount: subtotal,
      marketplaceFee: komisi, // potongan/komisi toko konsinyasi
      shippingSubsidy: 0,
      netAmount: subtotal - komisi,
      items: {
        create: {
          productId: product.id,
          marketplaceSku: product.sku,
          productName: product.name,
          qty,
          price,
          subtotal,
        },
      },
    },
  });

  revalidatePath("/konsinyasi");
  revalidatePath("/pembukuan");
  revalidatePath("/");
}

export async function deleteKonsinyasiSale(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.order.delete({ where: { id } });
  revalidatePath("/konsinyasi");
  revalidatePath("/pembukuan");
  revalidatePath("/");
}
