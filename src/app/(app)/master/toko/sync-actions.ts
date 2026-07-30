"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncAllStores } from "@/lib/syncAll";

// Tombol "Sync semua toko" — tarik order semua toko OAuth aktif sekaligus (90 hari).
export async function syncAll() {
  let q: string;
  try {
    const r = await syncAllStores(90);
    q = `sync=ok&created=${r.created}&updated=${r.updated}`;
    if (r.errors.length) q += `&err=${r.errors.length}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    q = `sync=error&reason=${encodeURIComponent(msg)}`;
  }

  revalidatePath("/master/toko");
  revalidatePath("/pembukuan");
  revalidatePath("/");
  redirect(`/master/toko?${q}`);
}
