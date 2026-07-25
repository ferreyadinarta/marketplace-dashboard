"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createStore(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const marketplace = String(formData.get("marketplace") ?? "");
  if (!name || !marketplace) return;
  await prisma.store.create({ data: { name, marketplace } });
  revalidatePath("/master/toko");
}

export async function updateStoreCredentials(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.store.update({
    where: { id },
    data: {
      apiKey: String(formData.get("apiKey") ?? "") || null,
      apiSecret: String(formData.get("apiSecret") ?? "") || null,
      shopIdApi: String(formData.get("shopIdApi") ?? "") || null,
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePath("/master/toko");
}

export async function deleteStore(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.store.delete({ where: { id } });
  revalidatePath("/master/toko");
}
