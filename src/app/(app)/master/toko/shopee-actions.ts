"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncShopeeStore } from "@/lib/shopee/sync";
import { startSyncJob, progressWriter, finishSyncJob } from "@/lib/syncProgress";

// Tarik order Shopee untuk satu toko. Rentangnya dipilih user (default 90 hari);
// dibatasi maks ~3 tahun supaya tidak memindai riwayat tanpa batas.
export async function syncShopee(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return;

  const raw = Number(formData.get("days") ?? 90);
  const days = Number.isFinite(raw) ? Math.min(1095, Math.max(1, Math.floor(raw))) : 90;
  // putaran ke-berapa (dipakai UI untuk melanjutkan otomatis sampai selesai)
  const round = Math.max(1, Math.floor(Number(formData.get("round") ?? 1)) || 1);
  // akumulasi hitungan lintas putaran biar angkanya tidak reset tiap lanjut
  const accCreated = Math.max(0, Math.floor(Number(formData.get("accCreated") ?? 0)) || 0);
  const accUpdated = Math.max(0, Math.floor(Number(formData.get("accUpdated") ?? 0)) || 0);

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });
  const jobId = await startSyncJob({
    storeId,
    storeName: store?.name ?? "Toko",
    scope: "STORE",
  });
  const progress = progressWriter(jobId);

  let q = "sync=ok";
  try {
    const r = await syncShopeeStore(storeId, from, to, {
      // hitungannya lanjut dari putaran sebelumnya biar angkanya tidak mundur
      onProgress: (p) =>
        progress({
          ...p,
          ...(p.created != null ? { created: accCreated + p.created } : {}),
          ...(p.updated != null ? { updated: accUpdated + p.updated } : {}),
          message: p.message ? `Putaran ${round} — ${p.message}` : undefined,
        }),
    });
    const created = accCreated + r.created;
    const updated = accUpdated + r.updated;
    await finishSyncJob(jobId, {
      phase: "done",
      created,
      updated,
      partial: r.partial,
      message: r.partial
        ? `Putaran ${round} selesai: ${created} baru, ${updated} diperbarui — lanjut otomatis`
        : `Selesai: ${created} baru, ${updated} diperbarui`,
    });
    q =
      `sync=${r.partial ? "partial" : "ok"}&created=${created}&updated=${updated}` +
      (r.partial ? `&storeId=${storeId}&days=${days}&round=${round + 1}` : "");
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
