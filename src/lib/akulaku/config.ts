// Akulaku Open Platform. Semua kredensial di env (private key = rahasia).
export const AKULAKU = {
  appId: process.env.AKULAKU_APP_ID ?? "",
  clientId: process.env.AKULAKU_CLIENT_ID ?? "",
  clientSecret: process.env.AKULAKU_CLIENT_SECRET ?? "",
  // private key PKCS8 (base64 tanpa header, atau PEM lengkap)
  privateKey: process.env.AKULAKU_PRIVATE_KEY ?? "",
  env: (process.env.AKULAKU_ENV ?? "live").toLowerCase(),
  // proxy ber-IP tetap (ex: http://user:pass@host:port) karena Akulaku wajib whitelist IP
  proxyUrl: process.env.AKULAKU_PROXY_URL ?? "",

  get host() {
    return this.env === "test" ? "https://test-openapi.akulaku.com" : "https://ec-oapi.akulaku.com";
  },
  get loginHost() {
    return this.env === "test" ? "https://test-developer.akulaku.com" : "https://developer.akulaku.com";
  },
  redirectUrl:
    process.env.AKULAKU_REDIRECT_URL ?? "https://pembukuan-marketplace.vercel.app/api/akulaku/callback",
};

export function akulakuConfigured(): boolean {
  return !!AKULAKU.appId && !!AKULAKU.clientId && !!AKULAKU.clientSecret && !!AKULAKU.privateKey;
}
