import { intlLocale, type Lang } from "./i18n";

export function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

// Server (Vercel) jalan di UTC, user & toko di WIB. Tanpa dipatok, jam sync
// tampil mundur 7 jam dan order jam 00.00–07.00 WIB kehitung ke tanggal kemarin.
// Semua tampilan & pengelompokan tanggal WAJIB lewat sini.
export const TZ = "Asia/Jakarta";

// "YYYY-MM-DD" menurut kalender Jakarta (en-CA kebetulan formatnya persis ini).
export function dateKey(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

// Bagian tahun/bulan/tanggal versi Jakarta — untuk pengelompokan (bukan tampilan).
export function jakartaParts(date: Date | string): { year: number; month: number; day: number } {
  const [y, m, d] = dateKey(date).split("-").map(Number);
  return { year: y, month: m, day: d };
}

// Ubah input tanggal (YYYY-MM-DD) jadi Date untuk event (restock/penjualan).
// Kalau tanggalnya HARI INI (atau kosong) → pakai timestamp SEKARANG, supaya
// event ini urut SETELAH opname yang mungkin dilakukan hari ini juga (kalau
// pakai tengah malam, event hari ini bisa dianggap "sebelum" opname → tidak terhitung).
export function eventDateFromInput(dateStr: string): Date {
  const now = new Date();
  if (!dateStr || dateStr === dateKey(now)) return now;
  // +07:00 eksplisit: tanpa itu string ini dibaca sebagai waktu server (UTC)
  return new Date(`${dateStr}T12:00:00+07:00`);
}

export function tanggal(date: Date | string, lang: Lang = "id"): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// Tanggal + jam (mis. untuk waktu sync terakhir): "30 Jul 2026, 14.05" WIB.
export function waktu(date: Date | string, lang: Lang = "id"): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// Rentang default: awal bulan berjalan sampai hari ini (format YYYY-MM-DD), WIB.
export function currentMonthRange(): { from: string; to: string } {
  const today = dateKey(new Date());
  return { from: `${today.slice(0, 7)}-01`, to: today };
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

const MARKETPLACE_LABEL_EN: Record<string, string> = {
  KONSINYASI: "Wholesale / Reseller",
  WA: "WhatsApp / Offline",
};
const STATUS_LABEL_EN: Record<string, string> = {
  PENDING: "Pending",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

// Versi sadar-bahasa dari dua peta di atas — pakai ini di UI.
export function marketplaceLabel(mp: string, lang: Lang = "id"): string {
  return (lang === "en" ? MARKETPLACE_LABEL_EN[mp] : undefined) ?? MARKETPLACE_LABEL[mp] ?? mp;
}
export function statusLabel(status: string, lang: Lang = "id"): string {
  return (lang === "en" ? STATUS_LABEL_EN[status] : STATUS_LABEL[status]) ?? status;
}
