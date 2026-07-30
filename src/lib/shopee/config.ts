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
};

export function shopeeConfigured(): boolean {
  return !!SHOPEE.partnerId && !!SHOPEE.partnerKey;
}
