import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Health check + keep-warm. Query ringan `SELECT 1` supaya compute Neon (free
// tier auto-suspend tiap 5 menit idle) tetap "bangun" → menghindari cold-start
// ~470ms di halaman. Panggil tiap ~4 menit dari scheduler eksternal
// (cron-job.org / UptimeRobot) karena Vercel Hobby cron cuma 1x/hari.
export async function GET() {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ms: Date.now() - t });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
