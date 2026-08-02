import { prisma } from "./prisma";
import { getStockLevels, type StockLevel } from "./stock";
import { sendToAll, pushConfigured } from "./push";

// format jumlah → box + sisa sachet (tanpa pecahan). ex: 34 sachet (1 box=16) → "2 box 2 sachet"
function fmtQty(l: StockLevel, qty: number): string {
  const n = Math.max(0, Math.floor(qty));
  if (l.packSize >= 2 && l.packUnit) {
    const box = Math.floor(n / l.packSize);
    const rem = n % l.packSize;
    const parts: string[] = [];
    if (box > 0 || rem === 0) parts.push(`${box} ${l.packUnit}`);
    if (rem > 0) parts.push(`${rem} ${l.unit}`);
    return parts.join(" ");
  }
  return `${n} ${l.unit}`;
}

// Cek stok menipis & kirim notifikasi — EDGE-TRIGGERED: hanya product yang BARU
// jatuh ke menipis/habis (belum pernah dinotif). Product yang stoknya naik lagi
// → reset flag biar bisa dinotif lagi nanti. Dipanggil dari cron harian.
export async function notifyLowStock(): Promise<{ sent: number; failed: number; fresh: number }> {
  // kalau push belum dikonfigurasi (env VAPID kosong) → jangan sentuh flag,
  // biar saat diaktifkan nanti tetap bisa memicu notif.
  if (!pushConfigured()) return { sent: 0, failed: 0, fresh: 0 };

  const levels = await getStockLevels();
  const lowNow = levels.filter((l) => l.status === "LOW" || l.status === "OUT");
  const lowNowIds = new Set(lowNow.map((l) => l.productId));

  // product yang saat ini bertanda "sudah dinotif"
  const flagged = await prisma.product.findMany({ where: { lowAlertSent: true }, select: { id: true } });
  const flaggedIds = new Set(flagged.map((p) => p.id));

  // reset flag untuk yang sudah TIDAK menipis lagi (stok naik) → bisa dinotif lagi nanti
  const recovered = [...flaggedIds].filter((id) => !lowNowIds.has(id));
  if (recovered.length) {
    await prisma.product.updateMany({ where: { id: { in: recovered } }, data: { lowAlertSent: false } });
  }

  // yang BARU menipis = menipis sekarang tapi belum ditandai
  const fresh = lowNow.filter((l) => !flaggedIds.has(l.productId));
  if (fresh.length === 0) return { sent: 0, failed: 0, fresh: 0 };

  await prisma.product.updateMany({
    where: { id: { in: fresh.map((l) => l.productId) } },
    data: { lowAlertSent: true },
  });

  // urutkan HABIS dulu, lalu menipis
  fresh.sort((a, b) => (a.status === "OUT" ? -1 : 1) - (b.status === "OUT" ? -1 : 1));
  const lines = fresh.slice(0, 8).map((l) =>
    l.status === "OUT"
      ? `• ${l.name} — HABIS`
      : `• ${l.name} — sisa ${fmtQty(l, l.current)} (min ${fmtQty(l, l.minStock)})`
  );
  const more = fresh.length > 8 ? `\n+${fresh.length - 8} product lagi` : "";
  const body = lines.join("\n") + more;
  const title = fresh.length === 1 ? "⚠️ Stok menipis" : `⚠️ ${fresh.length} product stok menipis`;

  const r = await sendToAll({ title, body, url: "/stok", tag: "stok-menipis" });
  return { ...r, fresh: fresh.length };
}

// bikin baris pesan dari daftar level menipis (HABIS dulu)
function buildBody(list: StockLevel[]): string {
  const sorted = [...list].sort((a, b) => (a.status === "OUT" ? -1 : 1) - (b.status === "OUT" ? -1 : 1));
  const lines = sorted.slice(0, 8).map((l) =>
    l.status === "OUT"
      ? `• ${l.name} — HABIS`
      : `• ${l.name} — sisa ${fmtQty(l, l.current)} (min ${fmtQty(l, l.minStock)})`
  );
  const more = sorted.length > 8 ? `\n+${sorted.length - 8} product lagi` : "";
  return lines.join("\n") + more;
}

// Cek MANUAL (tombol) — kirim daftar stok menipis SAAT INI, abaikan flag.
// Berguna karena cron cuma jalan 1×/hari; ini biar bisa cek kapan saja.
export async function checkLowStockNow(): Promise<{ sent: number; failed: number; low: number }> {
  if (!pushConfigured()) return { sent: 0, failed: 0, low: 0 };
  const levels = await getStockLevels();
  const low = levels.filter((l) => l.status === "LOW" || l.status === "OUT");

  if (low.length === 0) {
    const r = await sendToAll({
      title: "✅ Stok aman",
      body: "Tidak ada product yang menipis saat ini.",
      url: "/stok",
      tag: "cek-stok",
    });
    return { ...r, low: 0 };
  }

  const title = low.length === 1 ? "⚠️ Stok menipis" : `⚠️ ${low.length} product stok menipis`;
  const r = await sendToAll({ title, body: buildBody(low), url: "/stok", tag: "stok-menipis" });
  return { ...r, low: low.length };
}
