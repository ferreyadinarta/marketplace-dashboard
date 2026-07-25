export function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function tanggal(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export const MARKETPLACE_LABEL: Record<string, string> = {
  SHOPEE: "Shopee",
  TIKTOK: "TikTok Shop",
  TOKOPEDIA: "Tokopedia",
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  SHIPPED: "Dikirim",
  COMPLETED: "Selesai",
  CANCELLED: "Batal",
  RETURNED: "Retur",
};
