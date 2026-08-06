"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncTiktokStore } from "@/lib/tiktok/sync";
import { startSyncJob, progressWriter, finishSyncJob } from "@/lib/syncProgress";

// Tarik order TikTok 90 hari terakhir untuk satu toko.
export async function syncTiktok(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return;

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });
  const jobId = await startSyncJob({ storeId, storeName: store?.name ?? "Toko", scope: "STORE" });
  const progress = progressWriter(jobId);

  let q = "sync=ok";
  try {
    const r = await syncTiktokStore(storeId, from, to, { onProgress: progress });
    await finishSyncJob(jobId, {
      phase: "done",
      created: r.created,
      updated: r.updated,
      message: `Selesai: ${r.created} baru, ${r.updated} diperbarui`,
    });
    q = `sync=ok&created=${r.created}&updated=${r.updated}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await finishSyncJob(jobId, { phase: "error", error: msg, message: `Gagal: ${msg}` });
    q = `sync=error&reason=${encodeURIComponent(msg)}`;
  }

  revalidatePath("/master/toko");
  revalidatePath("/pembukuan");
  revalidatePath("/");
  redirect(`/master/toko?${q}`);
}
