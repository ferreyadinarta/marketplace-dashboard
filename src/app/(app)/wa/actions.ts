"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { buildItemsData } from "@/lib/sales";
import { eventDateFromInput } from "@/lib/format";

// Pastikan ada satu "toko" channel WhatsApp/Offline untuk menampung penjualan manual.
async function getWaStoreId(): Promise<string> {
  const existing = await prisma.store.findFirst({ where: { marketplace: "WA" } });
  if (existing) return existing.id;
  const created = await prisma.store.create({
    data: { name: "WhatsApp / Offline", marketplace: "WA" },
  });
  return created.id;
}

// Catat penjualan manual (WA / offline) ke pembeli langsung, harga retail.
// Bisa BANYAK product dalam 1 order. Jadi order COMPLETED → masuk pembukuan,
// dashboard, dan stok.
export async function createWaSale(formData: FormData) {
  const tanggalStr = String(formData.get("tanggal") ?? "");
  const buyerName = String(formData.get("buyerName") ?? "").trim() || null;

  const itemsData = await buildItemsData(formData);
  if (itemsData.length === 0) return;

  const storeId = await getWaStoreId();
  const orderDate = eventDateFromInput(tanggalStr);
  const total = itemsData.reduce((a, x) => a + x.subtotal, 0);
  const ref = `WA-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  await prisma.order.create({
    data: {
      storeId,
      marketplaceOrderId: ref,
      orderDate,
      status: "COMPLETED",
      buyerName,
      totalAmount: total,
      marketplaceFee: 0,
      shippingSubsidy: 0,
      netAmount: total,
      items: { create: itemsData },
    },
  });

  revalidatePath("/wa");
  revalidatePath("/pembukuan");
  revalidatePath("/stok");
  revalidatePath("/");
}

export async function deleteWaSale(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.order.delete({ where: { id } });
  revalidatePath("/wa");
  revalidatePath("/pembukuan");
  revalidatePath("/stok");
  revalidatePath("/");
}
