export function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

// Ubah input tanggal (YYYY-MM-DD) jadi Date untuk event (restock/penjualan).
// Kalau tanggalnya HARI INI (atau kosong) → pakai timestamp SEKARANG, supaya
// event ini urut SETELAH opname yang mungkin dilakukan hari ini juga (kalau
// pakai tengah malam, event hari ini bisa dianggap "sebelum" opname → tidak terhitung).
export function eventDateFromInput(dateStr: string): Date {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (!dateStr || dateStr === todayStr) return now;
  return new Date(`${dateStr}T12:00:00`);
}

export function tanggal(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// Tanggal + jam (mis. untuk waktu sync terakhir): "30 Jul 2026, 14.05".
export function waktu(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  KONSINYASI: "Grosir / Reseller", // dulu "konsinyasi", sebenarnya jual putus
  WA: "WhatsApp / Offline",
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  SHIPPED: "Dikirim",
  COMPLETED: "Selesai",
  CANCELLED: "Batal",
  RETURNED: "Retur",
};
