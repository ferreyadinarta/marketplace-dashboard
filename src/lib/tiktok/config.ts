// Konfigurasi TikTok Shop Open API.
// App key/secret & service id diambil dari env (jangan hardcode secret).
export const TIKTOK = {
  appKey: process.env.TIKTOK_APP_KEY ?? "",
  appSecret: process.env.TIKTOK_APP_SECRET ?? "",
  // Service ID app (tampil di Partner Center; bukan rahasia). Untuk authorize URL.
  serviceId: process.env.TIKTOK_SERVICE_ID ?? "",

  // Endpoint global (region ID pakai domain global shop)
  baseUrl: "https://open-api.tiktokglobalshop.com",
  authorizeUrl: "https://services.tiktokshop.com/open/authorize",
  tokenUrl: "https://auth.tiktok-shops.com/api/v2/token/get",
  refreshUrl: "https://auth.tiktok-shops.com/api/v2/token/refresh",

  // versi API yang dipakai
  apiVersion: "202309",
};

export function tiktokConfigured(): boolean {
  return !!TIKTOK.appKey && !!TIKTOK.appSecret;
}
