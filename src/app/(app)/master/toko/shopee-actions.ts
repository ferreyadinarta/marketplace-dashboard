"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncShopeeStore } from "@/lib/shopee/sync";

// Tarik order Shopee 90 hari terakhir untuk satu toko.
export async function syncShopee(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return;

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);

  let q = "sync=ok";
  try {
    const r = await syncShopeeStore(storeId, from, to);
    q = `sync=ok&created=${r.created}&updated=${r.updated}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    q = `sync=error&reason=${encodeURIComponent(msg)}`;
  }

  revalidatePath("/master/toko");
  revalidatePath("/pembukuan");
  revalidatePath("/");
  redirect(`/master/toko?${q}`);
}
