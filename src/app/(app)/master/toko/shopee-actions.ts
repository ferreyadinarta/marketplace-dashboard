"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncShopeeStore } from "@/lib/shopee/sync";

// Tarik order Shopee untuk satu toko. Rentangnya dipilih user (default 90 hari);
// dibatasi maks ~3 tahun supaya tidak memindai riwayat tanpa batas.
export async function syncShopee(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return;

  const raw = Number(formData.get("days") ?? 90);
  const days = Number.isFinite(raw) ? Math.min(1095, Math.max(1, Math.floor(raw))) : 90;

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  let q = "sync=ok";
  try {
    const r = await syncShopeeStore(storeId, from, to);
    q = `sync=${r.partial ? "partial" : "ok"}&created=${r.created}&updated=${r.updated}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    q = `sync=error&reason=${encodeURIComponent(msg)}`;
  }

  revalidatePath("/master/toko");
  revalidatePath("/pembukuan");
  revalidatePath("/");
  redirect(`/master/toko?${q}`);
}
