import { SHOPEE } from "./config";
import { sign, nowTimestamp } from "./sign";

// ---------- Authorize (langkah 1: seller klik izinkan) ----------
// Redirect seller ke halaman izin Shopee. Setelah setuju, Shopee balik ke
// redirectUrl membawa ?code=...&shop_id=...
export function getAuthorizeUrl(): string {
  const path = "/api/v2/shop/auth_partner";
  const ts = nowTimestamp();
  const s = sign(path, ts);
  const p = new URLSearchParams({
    partner_id: SHOPEE.partnerId,
    timestamp: String(ts),
    sign: s,
    redirect: SHOPEE.redirectUrl,
  });
  return `${SHOPEE.host}${path}?${p.toString()}`;
}

// ---------- Token ----------
export type ShopeeToken = {
  accessToken: string;
  refreshToken: string;
  expireIn: number; // detik (biasanya 14400 = 4 jam)
};

type TokenApi = {
  error?: string;
  message?: string;
  access_token?: string;
  refresh_token?: string;
  expire_in?: number;
};

// Public API POST (auth): sign hanya partner_id+path+timestamp, tanpa access_token.
async function publicPost(path: string, body: Record<string, unknown>): Promise<TokenApi> {
  const ts = nowTimestamp();
  const s = sign(path, ts);
  const p = new URLSearchParams({ partner_id: SHOPEE.partnerId, timestamp: String(ts), sign: s });
  const res = await fetch(`${SHOPEE.host}${path}?${p.toString()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as TokenApi;
  if (json.error) throw new Error(`Shopee ${path} gagal: ${json.error} ${json.message ?? ""}`.trim());
  return json;
}

export async function exchangeToken(code: string, shopId: string): Promise<ShopeeToken> {
  const j = await publicPost("/api/v2/auth/token/get", {
    code,
    shop_id: Number(shopId),
    partner_id: Number(SHOPEE.partnerId),
  });
  return {
    accessToken: j.access_token ?? "",
    refreshToken: j.refresh_token ?? "",
    expireIn: j.expire_in ?? 14400,
  };
}

export async function refreshAccessToken(refreshToken: string, shopId: string): Promise<ShopeeToken> {
  const j = await publicPost("/api/v2/auth/access_token/get", {
    refresh_token: refreshToken,
    shop_id: Number(shopId),
    partner_id: Number(SHOPEE.partnerId),
  });
  return {
    accessToken: j.access_token ?? "",
    refreshToken: j.refresh_token ?? "",
    expireIn: j.expire_in ?? 14400,
  };
}

// ---------- Signed GET untuk shop-level API ----------
async function shopGet<T>(
  path: string,
  accessToken: string,
  shopId: string,
  query: Record<string, string> = {}
): Promise<T> {
  const ts = nowTimestamp();
  const s = sign(path, ts, { accessToken, shopId });
  const p = new URLSearchParams({
    partner_id: SHOPEE.partnerId,
    timestamp: String(ts),
    access_token: accessToken,
    shop_id: shopId,
    sign: s,
    ...query,
  });
  const res = await fetch(`${SHOPEE.host}${path}?${p.toString()}`);
  const json = (await res.json()) as { error?: string; message?: string; response?: T };
  if (json.error) throw new Error(`Shopee ${path} gagal: ${json.error} ${json.message ?? ""}`.trim());
  return json.response as T;
}

// ---------- Orders ----------
export type ShopeeOrderDetail = {
  order_sn: string;
  order_status: string; // UNPAID | READY_TO_SHIP | PROCESSED | SHIPPED | COMPLETED | IN_CANCEL | CANCELLED | TO_RETURN
  create_time: number; // unix seconds
  buyer_username?: string;
  total_amount?: number;
  currency?: string;
  item_list?: {
    item_name?: string;
    item_sku?: string;
    model_sku?: string;
    model_quantity_purchased?: number;
    model_discounted_price?: number;
    model_original_price?: number;
  }[];
};

// Ambil daftar order_sn dalam rentang waktu (paginate cursor). Window ≤ 15 hari.
export async function getOrderSnList(
  accessToken: string,
  shopId: string,
  fromSec: number,
  toSec: number
): Promise<string[]> {
  const all: string[] = [];
  let cursor = "";
  for (let i = 0; i < 200; i++) {
    const r = await shopGet<{ order_list?: { order_sn: string }[]; more?: boolean; next_cursor?: string }>(
      "/api/v2/order/get_order_list",
      accessToken,
      shopId,
      {
        time_range_field: "create_time",
        time_from: String(fromSec),
        time_to: String(toSec),
        page_size: "100",
        ...(cursor ? { cursor } : {}),
      }
    );
    for (const o of r.order_list ?? []) all.push(o.order_sn);
    if (!r.more || !r.next_cursor) break;
    cursor = r.next_cursor;
  }
  return all;
}

// Detail order (maks 50 order_sn per panggilan).
export async function getOrderDetails(
  accessToken: string,
  shopId: string,
  orderSns: string[]
): Promise<ShopeeOrderDetail[]> {
  const out: ShopeeOrderDetail[] = [];
  const fields = "item_list,total_amount,buyer_username,order_status,create_time,currency";
  for (let i = 0; i < orderSns.length; i += 50) {
    const chunk = orderSns.slice(i, i + 50);
    const r = await shopGet<{ order_list?: ShopeeOrderDetail[] }>(
      "/api/v2/order/get_order_detail",
      accessToken,
      shopId,
      { order_sn_list: chunk.join(","), response_optional_fields: fields }
    );
    out.push(...(r.order_list ?? []));
  }
  return out;
}
