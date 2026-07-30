import crypto from "crypto";
import { SHOPEE } from "./config";

// Tanda tangan request Shopee Open API v2.
// Base string:
//   Public API (auth/token): partner_id + api_path + timestamp
//   Shop API   (order/shop): partner_id + api_path + timestamp + access_token + shop_id
// HMAC-SHA256 dengan key = partner_key, hasil hex.
export function sign(
  apiPath: string,
  timestamp: number,
  opts: { accessToken?: string; shopId?: string } = {}
): string {
  let base = `${SHOPEE.partnerId}${apiPath}${timestamp}`;
  if (opts.accessToken) base += opts.accessToken;
  if (opts.shopId) base += opts.shopId;
  return crypto.createHmac("sha256", SHOPEE.partnerKey).update(base, "utf8").digest("hex");
}

export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
