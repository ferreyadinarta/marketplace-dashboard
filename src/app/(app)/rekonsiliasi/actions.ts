"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncShopeePayouts } from "@/lib/shopee/sync";
import { syncBlibliPayouts } from "@/lib/blibli/sync";
import { eventDateFromInput } from "@/lib/format";
import { getT } from "@/lib/i18n-server";

// Tarik data PENCAIRAN dari Shopee (escrow) & Blibli (settlement) untuk semua toko
// yang terhubung. Order yang dananya sudah cair ditandai ke payout-nya,
// jadi kolom "Dana Cair" & "Selisih" di halaman ini terisi sendiri.
//
// Tidak redirect: dipanggil lewat fetch dari tombol di klien, biar halaman tidak
// beku & user bebas pindah halaman (sama seperti sync order).
// Posisi kerja per toko antar putaran: tanggal lanjutan (ISO), "again" (ulang dari terbaru), atau "done"
export type PayoutState = Record<string, string>;

const ALL_DAYS = 3650;

export async function syncPayouts(days = 90, state: PayoutState = {}) {
  const { t } = await getT();
  const stores = await prisma.store.findMany({
    where: { marketplace: { in: ["SHOPEE", "BLIBLI"] }, isActive: true, accessToken: { not: null } },
  });

  const now = new Date();
  const next: PayoutState = { ...state };
  let payouts = 0;
  let orders = 0;
  let amount = 0;
  let unmatched = 0;
  const errors: string[] = [];

  // bagi jatah waktu function (maks 60 detik) ke toko yang belum selesai
  const budgetMs = 40_000;
  const started = Date.now();
  const todo = stores.filter((s) => next[s.id] !== "done");

  for (const [i, s] of todo.entries()) {
    const left = budgetMs - (Date.now() - started);
    if (left <= 3_000) break;
    try {
      // "semua data" = mulai dari order tertua toko itu (pencairan sebelum itu tidak berguna)
      let from = new Date(now.getTime() - Math.max(1, Math.floor(days)) * 24 * 3600 * 1000);
      if (days >= ALL_DAYS) {
        const oldest = await prisma.order.findFirst({
          where: { storeId: s.id },
          orderBy: { orderDate: "asc" },
          select: { orderDate: true },
        });
        if (!oldest) {
          next[s.id] = "done";
          continue;
        }
        from = new Date(oldest.orderDate.getTime() - 24 * 3600 * 1000);
      }
      const resume = next[s.id] ? new Date(next[s.id]) : null;
      const to = resume && !isNaN(resume.getTime()) ? resume : now;
      const deadlineMs = Math.max(5_000, Math.floor(left / Math.max(1, todo.length - i)));

      if (s.marketplace === "BLIBLI") {
        const r = await syncBlibliPayouts(s.id, from, to, { deadlineMs });
        payouts += r.payouts;
        orders += r.orders;
        amount += r.amount;
        unmatched += r.unmatched;
        next[s.id] = r.partial ? "again" : "done"; // settlement yang sudah tercatat dilewati otomatis
      } else {
        const r = await syncShopeePayouts(s.id, from, to, { deadlineMs });
        payouts += r.payouts;
        orders += r.orders;
        amount += r.amount;
        unmatched += r.unmatched;
        // tidak maju sama sekali → hentikan, jangan berputar terus
        if (r.resumeTo && r.resumeTo.getTime() >= to.getTime()) throw new Error(t("Shopee terlalu lambat, coba lagi nanti", "Shopee is too slow, try again later"));
        next[s.id] = r.resumeTo ? r.resumeTo.toISOString() : "done";
      }
    } catch (e) {
      next[s.id] = "done"; // jangan diulang terus; error ditampilkan
      errors.push(`${s.name}: ${e instanceof Error ? e.message : t("tidak diketahui", "unknown")}`);
    }
  }

  revalidatePath("/rekonsiliasi");
  revalidatePath("/");
  const done = stores.every((s) => next[s.id] === "done");
  return { payouts, orders, amount, unmatched, errors, stores: stores.length, state: next, done };
}

// ---------- Pencairan manual ----------
// Untuk toko yang TIDAK punya API (Grosir/Reseller, WA, atau marketplace yang
// datanya diinput manual): catat sendiri uang yang benar-benar diterima.
// Selisihnya jadi piutang — berapa yang sudah dijual tapi belum dibayar.
export async function addManualPayout(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const amountRaw = Number(formData.get("amount") ?? 0);
  const amount = Number.isFinite(amountRaw) ? Math.floor(amountRaw) : 0;
  const reference = String(formData.get("reference") ?? "").trim();
  const tanggal = String(formData.get("tanggal") ?? "").trim();
  if (!storeId || amount <= 0) return;

  await prisma.payout.create({
    data: {
      storeId,
      amount,
      reference: reference || null,
      payoutDate: eventDateFromInput(tanggal),
    },
  });

  revalidatePath("/rekonsiliasi");
  revalidatePath("/");
}

// Hapus pencairan (salah input). Order yang tadinya menempel jadi lepas sendiri
// karena relasinya SetNull.
export async function deletePayout(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.payout.deleteMany({ where: { id } });
  revalidatePath("/rekonsiliasi");
  revalidatePath("/");
}
