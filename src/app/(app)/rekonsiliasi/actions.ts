"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncShopeePayouts } from "@/lib/shopee/sync";

// Tarik data PENCAIRAN dari Shopee (escrow yang sudah rilis) untuk semua toko
// Shopee yang terhubung. Order yang dananya sudah cair ditandai ke payout-nya,
// jadi kolom "Dana Cair" & "Selisih" di halaman ini terisi sendiri.
//
// Tidak redirect: dipanggil lewat fetch dari tombol di klien, biar halaman tidak
// beku & user bebas pindah halaman (sama seperti sync order).
export async function syncPayouts(days = 90) {
  const stores = await prisma.store.findMany({
    where: { marketplace: "SHOPEE", isActive: true, accessToken: { not: null } },
  });

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - Math.min(365, Math.max(1, Math.floor(days))));

  let payouts = 0;
  let orders = 0;
  let amount = 0;
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
    } catch (e) {
      errors.push(`${s.name}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  revalidatePath("/rekonsiliasi");
  revalidatePath("/");
  return { payouts, orders, amount, errors, stores: stores.length };
}
