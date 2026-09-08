import webpush from "web-push";
import { prisma } from "./prisma";

// Konfigurasi Web Push (VAPID) dari env. Kalau belum di-set, fitur push nonaktif
// (semua fungsi jadi no-op) — app tetap jalan normal tanpa notifikasi.
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "https://pembukuan-marketplace.vercel.app";

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

type Hasil = { status: "ok" | "dead" | "fail"; reason?: string };

async function deliver(sub: SubRow, payload: PushPayload): Promise<Hasil> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return { status: "ok" };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const code = err?.statusCode;
    // alasan aslinya dibawa keluar — tanpa ini semua kegagalan terlihat sama
    const reason = `${code ?? "?"} ${(err?.body || err?.message || "").toString().slice(0, 120)}`.trim();
    // 404/410 = langganan mati (device unsub / browser buang) → hapus
    return { status: code === 404 || code === 410 ? "dead" : "fail", reason };
  }
}

// Kirim ke SEMUA device yang berlangganan. Buang langganan yang sudah mati.
export type SendResult = { sent: number; failed: number; subs: number; reason?: string };

export async function sendToAll(payload: PushPayload): Promise<SendResult> {
  if (!pushConfigured()) {
    return { sent: 0, failed: 0, subs: 0, reason: "VAPID belum di-set di server" };
  }
  ensureConfigured();

  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) {
    return { sent: 0, failed: 0, subs: 0, reason: "belum ada device yang berlangganan" };
  }

  const dead: string[] = [];
  let sent = 0;
  let failed = 0;
  let reason: string | undefined;

  await Promise.all(
    subs.map(async (s) => {
      const r = await deliver(s, payload);
      if (r.status === "ok") sent++;
      else {
        failed++;
        reason ??= r.reason;
        if (r.status === "dead") dead.push(s.endpoint);
      }
    })
  );

  if (dead.length) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
  return { sent, failed, subs: subs.length, reason };
}
