// Kontrak adapter marketplace.
//
// Tiap marketplace (Shopee, TikTok Shop, Tokopedia) balikin response API dengan
// bentuk BERBEDA. Adapter tugasnya: ubah response mentah API → bentuk seragam
// (NormalizedOrder) di bawah ini. Sisa aplikasi HANYA kenal bentuk seragam ini.
//
// Jadi kalau bentuk response API asli beda dengan dugaan, yang diubah CUKUP
// adapter-nya — schema database, dashboard, pembukuan tidak perlu disentuh.

export type NormalizedOrderItem = {
  marketplaceSku: string;
  productName: string;
  qty: number;
  price: number; // harga satuan, rupiah bulat
  subtotal: number;
};

export type NormalizedOrder = {
  marketplaceOrderId: string;
  orderDate: Date;
  status: "PENDING" | "SHIPPED" | "COMPLETED" | "CANCELLED" | "RETURNED";
  buyerName?: string; // username/nama pembeli
  totalAmount: number; // total dibayar pembeli
  marketplaceFee: number; // total potongan marketplace
  shippingSubsidy: number;
  netAmount: number; // yang seharusnya cair ke seller
  items: NormalizedOrderItem[];
};

export type NormalizedPayout = {
  payoutDate: Date;
  amount: number;
  reference?: string;
  orderIds: string[]; // marketplaceOrderId yang dicairkan di batch ini
};

export interface MarketplaceAdapter {
  marketplace: "SHOPEE" | "TIKTOK" | "TOKOPEDIA";

  // ambil order dalam rentang tanggal, sudah dinormalisasi
  fetchOrders(params: {
    apiKey: string;
    apiSecret: string;
    shopIdApi: string;
    from: Date;
    to: Date;
  }): Promise<NormalizedOrder[]>;

  // ambil data pencairan dana untuk rekonsiliasi
  fetchPayouts(params: {
    apiKey: string;
    apiSecret: string;
    shopIdApi: string;
    from: Date;
    to: Date;
  }): Promise<NormalizedPayout[]>;
}
