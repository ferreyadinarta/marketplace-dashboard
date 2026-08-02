import webpush from "web-push";
import { prisma } from "./prisma";

// Konfigurasi Web Push (VAPID) dari env. Kalau belum di-set, fitur push nonaktif
// (semua fungsi jadi no-op) — app tetap jalan normal tanpa notifikasi.
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:noreply@pembukuan-marketplace.vercel.app";

let configured = false;

export function pushConfigured(): boolean {
  return !!VAPID_PUBLIC && !!VAPID_PRIVATE;
}

function ensureConfigured() {
  if (configured || !pushConfigured()) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // dibuka saat notifikasi diklik (default /stok)
  tag?: string;
};

type SubRow = { endpoint: string; p256dh: string; auth: string };

async function deliver(sub: SubRow, payload: PushPayload): Promise<"ok" | "dead" | "fail"> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number })?.statusCode;
    // 404/410 = langganan mati (device unsub / browser buang) → hapus
    return code === 404 || code === 410 ? "dead" : "fail";
  }
}

// Kirim ke SEMUA device yang berlangganan. Buang langganan yang sudah mati.
export async function sendToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!pushConfigured()) return { sent: 0, failed: 0 };
  ensureConfigured();

  const subs = await prisma.pushSubscription.findMany();
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      const r = await deliver(s, payload);
      if (r === "ok") sent++;
      else {
        failed++;
        if (r === "dead") dead.push(s.endpoint);
      }
    })
  );

  if (dead.length) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
  return { sent, failed };
}
