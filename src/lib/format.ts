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

// Rentang default: awal bulan berjalan sampai hari ini (format YYYY-MM-DD).
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${pad(now.getDate())}` };
}

export const MARKETPLACE_LABEL: Record<string, string> = {
  SHOPEE: "Shopee",
  TIKTOK: "TikTok Shop",
  TOKOPEDIA: "Tokopedia",
  KONSINYASI: "Konsinyasi",
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  SHIPPED: "Dikirim",
  COMPLETED: "Selesai",
  CANCELLED: "Batal",
  RETURNED: "Retur",
};
