import type { MarketplaceAdapter, NormalizedOrder, NormalizedPayout } from "./types";

// Adapter Tokopedia — TODO: isi saat akses developer (GoTo/TikTok Shop) siap.
//
// Docs: https://developer.tokopedia.com
export const tokopediaAdapter: MarketplaceAdapter = {
  marketplace: "TOKOPEDIA",

  async fetchOrders(): Promise<NormalizedOrder[]> {
    throw new Error("Adapter Tokopedia belum diaktifkan. Isi kredensial API dulu.");
  },

  async fetchPayouts(): Promise<NormalizedPayout[]> {
    throw new Error("Adapter Tokopedia belum diaktifkan.");
  },
};
