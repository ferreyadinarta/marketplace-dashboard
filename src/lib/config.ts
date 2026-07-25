// Pemilih environment: sandbox (uji) vs production (asli).
// Diatur lewat variabel MARKETPLACE_ENV di file .env.
//
// sandbox    -> pakai endpoint test tiap marketplace, order palsu, DB terpisah.
// production -> endpoint asli, toko sungguhan.
//
// Tujuan: saat testing tidak pernah menyentuh toko/dana asli kakak.

export type AppEnv = "sandbox" | "production";

export const APP_ENV: AppEnv =
  process.env.MARKETPLACE_ENV === "production" ? "production" : "sandbox";

// Base URL API tiap marketplace per environment.
// Ganti nilai production dengan endpoint resmi saat akun sudah approve.
export const API_BASE: Record<string, Record<AppEnv, string>> = {
  SHOPEE: {
    sandbox: "https://partner.test-stable.shopeemobile.com",
    production: "https://partner.shopeemobile.com",
  },
  TIKTOK: {
    sandbox: "https://open-api-sandbox.tiktokglobalshop.com",
    production: "https://open-api.tiktokglobalshop.com",
  },
  TOKOPEDIA: {
    sandbox: "https://fs.tokopedia.net", // Tokopedia pakai satu host; mode diatur di level akun/app
    production: "https://fs.tokopedia.net",
  },
};

export function baseUrl(marketplace: string): string {
  return API_BASE[marketplace]?.[APP_ENV] ?? "";
}

export const IS_SANDBOX = APP_ENV === "sandbox";
