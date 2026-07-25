import type { MarketplaceAdapter, NormalizedOrder, NormalizedPayout } from "./types";

// Adapter Shopee — TODO: isi saat akun Shopee Open Platform sudah approve.
//
// Langkah nanti:
// 1. Panggil Shopee Order API (v2/order/get_order_list + get_order_detail).
// 2. Map field response → NormalizedOrder (lihat komentar per field).
// 3. Handle auth: Shopee pakai partner_id + sign HMAC-SHA256 + access_token.
//
// Docs: https://open.shopee.com/documents
export const shopeeAdapter: MarketplaceAdapter = {
  marketplace: "SHOPEE",

  async fetchOrders(): Promise<NormalizedOrder[]> {
    // Contoh mapping (pseudo):
    //   totalAmount     <- order.total_amount
    //   marketplaceFee  <- sum(order.income_details.*_fee)
    //   status          <- map(order.order_status)  // READY_TO_SHIP -> SHIPPED, COMPLETED -> COMPLETED
    //   items[].marketplaceSku <- item.model_sku || item.item_sku
    throw new Error("Adapter Shopee belum diaktifkan. Isi kredensial API dulu.");
  },

  async fetchPayouts(): Promise<NormalizedPayout[]> {
    throw new Error("Adapter Shopee belum diaktifkan.");
  },
};
