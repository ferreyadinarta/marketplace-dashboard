import type { MarketplaceAdapter, NormalizedOrder, NormalizedPayout } from "./types";

// Adapter TikTok Shop — TODO: isi saat app TikTok Shop Partner sudah approve.
// Catatan: pasca-merger, toko Tokopedia sebagian bisa diakses lewat TikTok Shop API.
// Cek dulu apakah butuh adapter Tokopedia terpisah atau cukup ini.
//
// Docs: https://partner.tiktokshop.com/docv2
export const tiktokAdapter: MarketplaceAdapter = {
  marketplace: "TIKTOK",

  async fetchOrders(): Promise<NormalizedOrder[]> {
    throw new Error("Adapter TikTok Shop belum diaktifkan. Isi kredensial API dulu.");
  },

  async fetchPayouts(): Promise<NormalizedPayout[]> {
    throw new Error("Adapter TikTok Shop belum diaktifkan.");
  },
};
