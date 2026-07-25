"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const hpp = Number(formData.get("hpp") ?? 0);
  const groupId = String(formData.get("groupId") ?? "");
  if (!name || !sku) return;

  await prisma.product.create({
    data: { name, sku, hpp: isNaN(hpp) ? 0 : hpp, groupId: groupId || null },
  });
  revalidatePath("/master/product");
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const hpp = Number(formData.get("hpp") ?? 0);
  const groupId = String(formData.get("groupId") ?? "");
  if (!id) return;

  await prisma.product.update({
    where: { id },
    data: { hpp: isNaN(hpp) ? 0 : hpp, groupId: groupId || null },
  });
  revalidatePath("/master/product");
  revalidatePath("/pembukuan");
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
  await prisma.bookkeepingGroup.create({ data: { name } });
  revalidatePath("/master/product");
}
