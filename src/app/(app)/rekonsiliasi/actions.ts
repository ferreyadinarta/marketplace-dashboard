"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncShopeePayouts } from "@/lib/shopee/sync";
import { eventDateFromInput } from "@/lib/format";
import { getT } from "@/lib/i18n-server";

// Tarik data PENCAIRAN dari Shopee (escrow yang sudah rilis) untuk semua toko
// Shopee yang terhubung. Order yang dananya sudah cair ditandai ke payout-nya,
// jadi kolom "Dana Cair" & "Selisih" di halaman ini terisi sendiri.
//
// Tidak redirect: dipanggil lewat fetch dari tombol di klien, biar halaman tidak
// beku & user bebas pindah halaman (sama seperti sync order).
export async function syncPayouts(days = 90) {
  const { t } = await getT();
  const stores = await prisma.store.findMany({
    where: { marketplace: "SHOPEE", isActive: true, accessToken: { not: null } },
  });

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - Math.min(365, Math.max(1, Math.floor(days))));

  let payouts = 0;
  let orders = 0;
  let amount = 0;
  let unmatched = 0;
  const errors: string[] = [];

  // bagi jatah waktu function (maks 60 detik) ke semua toko
  const budgetMs = 40_000;
  const started = Date.now();

  for (const [i, s] of stores.entries()) {
    const left = budgetMs - (Date.now() - started);
    if (left <= 2_000) break;
    try {
      const r = await syncShopeePayouts(s.id, from, to, {
        deadlineMs: Math.max(5_000, Math.floor(left / Math.max(1, stores.length - i))),
      });
      payouts += r.payouts;
      orders += r.orders;
      amount += r.amount;
      unmatched += r.unmatched;
    } catch (e) {
      errors.push(`${s.name}: ${e instanceof Error ? e.message : t("tidak diketahui", "unknown")}`);
    }
  }

  revalidatePath("/rekonsiliasi");
  revalidatePath("/");
  return { payouts, orders, amount, unmatched, errors, stores: stores.length };
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
