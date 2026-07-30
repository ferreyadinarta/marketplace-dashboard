import { TIKTOK } from "./config";
import { signRequest, nowTimestamp } from "./sign";

// ---------- Authorize (langkah 1: seller klik izinkan) ----------
export function getAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({ service_id: TIKTOK.serviceId, state });
  return `${TIKTOK.authorizeUrl}?${p.toString()}`;
}

// ---------- Token ----------
export type TokenResult = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpireAt: number; // unix seconds
};

type TokenApi = {
  code?: number;
  message?: string;
  data?: {
    access_token: string;
    refresh_token: string;
    access_token_expire_in: number; // unix seconds (absolute)
  };
};

export async function exchangeToken(authCode: string): Promise<TokenResult> {
  const p = new URLSearchParams({
    app_key: TIKTOK.appKey,
    app_secret: TIKTOK.appSecret,
    auth_code: authCode,
    grant_type: "authorized_code",
  });
  const res = await fetch(`${TIKTOK.tokenUrl}?${p.toString()}`);
  const json = (await res.json()) as TokenApi;
  if (json.code !== 0 || !json.data) {
    throw new Error(`TikTok token exchange gagal: ${json.message ?? res.status}`);
  }
  return {
    accessToken: json.data.access_token,
    refreshToken: json.data.refresh_token,
    accessTokenExpireAt: json.data.access_token_expire_in,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  const p = new URLSearchParams({
    app_key: TIKTOK.appKey,
    app_secret: TIKTOK.appSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(`${TIKTOK.refreshUrl}?${p.toString()}`);
  const json = (await res.json()) as TokenApi;
  if (json.code !== 0 || !json.data) {
    throw new Error(`TikTok token refresh gagal: ${json.message ?? res.status}`);
  }
  return {
    accessToken: json.data.access_token,
    refreshToken: json.data.refresh_token,
    accessTokenExpireAt: json.data.access_token_expire_in,
  };
}

// ---------- Signed fetch untuk Open API ----------
async function signedFetch<T>(
  method: "GET" | "POST",
  path: string,
  accessToken: string,
  opts: { shopCipher?: string; query?: Record<string, string>; body?: unknown } = {}
): Promise<T> {
  const params: Record<string, string> = {
    app_key: TIKTOK.appKey,
    timestamp: nowTimestamp(),
    ...(opts.shopCipher ? { shop_cipher: opts.shopCipher } : {}),
    ...(opts.query ?? {}),
  };
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  const sign = signRequest(path, params, TIKTOK.appSecret, bodyStr);

  const url = `${TIKTOK.baseUrl}${path}?${new URLSearchParams({ ...params, sign }).toString()}`;
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": accessToken,
    },
    body: bodyStr,
  });
  const json = (await res.json()) as { code?: number; message?: string; data?: T };
  if (json.code !== 0) {
    throw new Error(`TikTok API ${path} gagal: ${json.message ?? res.status}`);
  }
  return json.data as T;
}

// ---------- Shops yang sudah authorize ----------
export type TiktokShop = { id: string; cipher: string; name: string; region?: string };

export async function getAuthorizedShops(accessToken: string): Promise<TiktokShop[]> {
  const data = await signedFetch<{ shops: TiktokShop[] }>(
    "GET",
    `/authorization/${TIKTOK.apiVersion}/shops`,
    accessToken
  );
  return data.shops ?? [];
}

// ---------- Products (untuk import katalog) ----------
export type TiktokProduct = {
  id: string;
  title?: string;
  skus?: { seller_sku?: string; price?: { sale_price?: string } }[];
};

// Cari semua product toko (paginate) untuk import ke Master Product.
export async function searchProducts(
  accessToken: string,
  shopCipher: string
): Promise<TiktokProduct[]> {
  const all: TiktokProduct[] = [];
  let pageToken = "";
  for (let i = 0; i < 100; i++) {
    const data = await signedFetch<{ products?: TiktokProduct[]; next_page_token?: string }>(
      "POST",
      `/product/${TIKTOK.apiVersion}/products/search`,
      accessToken,
      {
        shopCipher,
        query: { page_size: "100", ...(pageToken ? { page_token: pageToken } : {}) },
        body: {},
      }
    );
    if (data.products?.length) all.push(...data.products);
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }
  return all;
}

// ---------- Orders ----------
// Bentuk order dari TikTok (subset yang kita pakai). Perlu diverifikasi saat test.
export type TiktokOrder = {
  id: string;
  status: string; // UNPAID | AWAITING_SHIPMENT | AWAITING_COLLECTION | IN_TRANSIT | DELIVERED | COMPLETED | CANCELLED
  create_time: number;
  buyer_email?: string;
  user_id?: string;
  payment?: {
    currency?: string;
    total_amount?: string;
    sub_total?: string;
    shipping_fee?: string;
    platform_discount?: string;
    seller_discount?: string;
    original_shipping_fee?: string;
    tax?: string;
  };
  line_items?: {
    id: string;
    product_id?: string;
    product_name?: string;
    seller_sku?: string;
    sku_id?: string;
    quantity?: number;
    sale_price?: string;
    original_price?: string;
  }[];
};

// Ambil semua order dalam rentang waktu (paginate).
export async function searchOrders(
  accessToken: string,
  shopCipher: string,
  fromSec: number,
  toSec: number
): Promise<TiktokOrder[]> {
  const all: TiktokOrder[] = [];
  let pageToken = "";
  // batasi loop biar aman
  for (let i = 0; i < 200; i++) {
    const data = await signedFetch<{ orders?: TiktokOrder[]; next_page_token?: string }>(
      "POST",
      `/order/${TIKTOK.apiVersion}/orders/search`,
      accessToken,
      {
        shopCipher,
        query: { page_size: "50", ...(pageToken ? { page_token: pageToken } : {}) },
        body: { create_time_ge: fromSec, create_time_lt: toSec },
      }
    );
    if (data.orders?.length) all.push(...data.orders);
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }
  return all;
}
