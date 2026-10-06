"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { testConnection } from "@/lib/blibli/client";
import { blibliCreds } from "@/lib/blibli/sync";

// Blibli tanpa login popup: siapkan kartu tokonya lalu buka form API-nya
export async function startBlibli() {
  const store =
    (await prisma.store.findFirst({ where: { marketplace: "BLIBLI" }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.store.create({ data: { name: "Blibli", marketplace: "BLIBLI" } }));
  redirect(`/master/toko?setup=${store.id}#store-${store.id}`);
}

export async function updateStoreCredentials(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.store.updateMany({
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

// Blibli: simpan kredensial lalu langsung tes 1 panggilan. Field rahasia kosong = pakai yang tersimpan.
export async function saveBlibliCredentials(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  const secret = (k: string) => text(k) || undefined;
  const store = await prisma.store.update({
    where: { id },
    data: {
      shopIdApi: text("storeCode") || null,
      apiUsername: text("username") || null,
      apiKey: text("clientId") || null,
      apiSecret: secret("clientKey"),
      accessToken: secret("sellerKey"),
      apiSignatureKey: formData.get("clearSignature") === "on" ? null : secret("signatureKey"),
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePath("/master/toko");

  let reason = "";
  try {
    await testConnection(blibliCreds(store));
  } catch (e) {
    reason = e instanceof Error ? e.message : "unknown";
  }
  // Blibli tak punya token kadaluarsa → tokenExpiresAt dipakai sebagai tanda "tes koneksi lolos"
  await prisma.store.update({ where: { id }, data: { tokenExpiresAt: reason ? null : new Date("2100-01-01") } });
  redirect(
    reason
      ? `/master/toko?blibli=error&reason=${encodeURIComponent(reason.slice(0, 300))}`
      : "/master/toko?blibli=connected"
  );
}

export async function deleteStore(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.store.deleteMany({ where: { id } });
  revalidatePath("/master/toko");
}
