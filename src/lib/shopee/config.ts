// Konfigurasi Shopee Open Platform API (v2).
// partner_id & partner_key dari env (jangan hardcode partner_key = rahasia).
export const SHOPEE = {
  partnerId: process.env.SHOPEE_PARTNER_ID ?? "",
  partnerKey: process.env.SHOPEE_PARTNER_KEY ?? "",
  // "sandbox" (app status Developing / Test creds) | "live" (setelah Go-Live)
  env: (process.env.SHOPEE_ENV ?? "live").toLowerCase(),

  get host() {
    return this.env === "sandbox"
      ? "https://openplatform.sandbox.test-stable.shopee.sg"
      : "https://partner.shopeemobile.com";
  },

  // URL callback yang di-whitelist di console (Test Redirect URL Domain).
  redirectUrl:
    process.env.SHOPEE_REDIRECT_URL ??
    "https://pembukuan-marketplace.vercel.app/api/shopee/callback",

  // URL push/webhook yang didaftarkan di console (Push Mechanism). Harus SAMA
  // persis dengan yang di console — dipakai untuk verifikasi tanda tangan push.
  webhookUrl:
    process.env.SHOPEE_WEBHOOK_URL ??
    "https://pembukuan-marketplace.vercel.app/api/shopee/webhook",

  // Kunci penanda-tangan PUSH. Di SANDBOX beda dari partner_key API — pakai
  // "Test Push Partner Key" dari console. Di produksi kosongkan → fallback ke
  // partnerKey (produksi pakai partner_key yang sama).
  pushPartnerKey: process.env.SHOPEE_PUSH_PARTNER_KEY ?? "",
};

export function shopeeConfigured(): boolean {
  return !!SHOPEE.partnerId && !!SHOPEE.partnerKey;
}
