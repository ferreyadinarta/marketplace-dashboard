"use server";

import { prisma } from "@/lib/prisma";
import { sendToAll } from "@/lib/push";
import { checkLowStockNow } from "@/lib/lowStock";

// Bentuk langganan dari browser (PushSubscription.toJSON()).
type WebSub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

// Simpan/segarkan langganan device ini.
// Selalu balikin objek (jangan throw) supaya UI bisa menampilkan alasan aslinya.
export async function subscribeUser(sub: WebSub): Promise<{ ok: boolean; reason?: string }> {
  const endpoint = sub?.endpoint ?? "";
  const p256dh = sub?.keys?.p256dh ?? "";
  const auth = sub?.keys?.auth ?? "";
  if (!endpoint || !p256dh || !auth) return { ok: false, reason: "data langganan tidak lengkap" };

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth },
      update: { p256dh, auth },
    });
    return { ok: true };
  } catch (e) {
    // paling sering: database lagi cold-start / tidak terjangkau
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 120) : "database error" };
  }
}

// Hapus langganan device ini (saat unsubscribe).
export async function unsubscribeUser(endpoint: string): Promise<{ ok: boolean }> {
  if (!endpoint) return { ok: false };
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true };
}

// Kirim notifikasi tes (buat memastikan izin & service worker jalan).
export async function sendTestNotification(): Promise<{ sent: number; failed: number }> {
  return sendToAll({
    title: "✅ Notifikasi aktif",
    body: "Kamu akan dapat pesan di sini kalau ada stok menipis.",
    url: "/stok",
    tag: "test",
  });
}

// Cek stok menipis SEKARANG (manual) → kirim ke semua device berlangganan.
export async function checkNow(): Promise<{ sent: number; failed: number; low: number }> {
  return checkLowStockNow();
}
