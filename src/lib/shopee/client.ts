import { SHOPEE } from "./config";
import { sign, nowTimestamp } from "./sign";
import type { ImportedProduct } from "@/lib/adapters/types";

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

// ---------- Katalog product (untuk import ke Master Product) ----------
type ShopeeItem = {
  item_id: number;
  item_name?: string;
  item_sku?: string;
  has_model?: boolean;
  price_info?: { current_price?: number }[];
};
type ShopeeModel = {
  model_sku?: string;
  price_info?: { current_price?: number }[];
};

// Ambil semua product toko (termasuk varian/model) → normalized ImportedProduct.
export async function fetchShopeeCatalog(
  accessToken: string,
  shopId: string
): Promise<ImportedProduct[]> {
  // 1. daftar item_id (paginate)
  const itemIds: number[] = [];
  let offset = 0;
  for (let i = 0; i < 100; i++) {
    const r = await shopGet<{ item?: { item_id: number }[]; has_next_page?: boolean; next_offset?: number }>(
      "/api/v2/product/get_item_list",
      accessToken,
      shopId,
      { offset: String(offset), page_size: "100", item_status: "NORMAL" }
    );
    for (const it of r.item ?? []) itemIds.push(it.item_id);
    if (!r.has_next_page) break;
    offset = r.next_offset ?? offset + 100;
  }

  // 2. detail per batch 50; varian → ambil model list
  const out: ImportedProduct[] = [];
  for (let i = 0; i < itemIds.length; i += 50) {
    const chunk = itemIds.slice(i, i + 50);
    const r = await shopGet<{ item_list?: ShopeeItem[] }>(
      "/api/v2/product/get_item_base_info",
      accessToken,
      shopId,
      { item_id_list: chunk.join(",") }
    );
    for (const it of r.item_list ?? []) {
      const name = it.item_name || "(tanpa nama)";
      if (it.has_model) {
        const m = await shopGet<{ model?: ShopeeModel[] }>(
          "/api/v2/product/get_model_list",
          accessToken,
          shopId,
          { item_id: String(it.item_id) }
        );
        for (const md of m.model ?? []) {
          out.push({
            sku: md.model_sku || "",
            name,
            price: Math.round(md.price_info?.[0]?.current_price ?? 0),
          });
        }
      } else {
        out.push({
          sku: it.item_sku || "",
          name,
          price: Math.round(it.price_info?.[0]?.current_price ?? 0),
        });
      }
    }
  }
  return out;
}

// ---------- Shop profile (nama + logo toko) ----------
export type ShopProfile = { shopName?: string; logoUrl?: string };

// Ambil profil toko (nama + foto). Balikin {} kalau gagal — jangan blok authorize.
export async function getShopProfile(accessToken: string, shopId: string): Promise<ShopProfile> {
  try {
    const r = await shopGet<{ shop_logo?: string; shop_name?: string }>(
      "/api/v2/shop/get_profile",
      accessToken,
      shopId
    );
    return { shopName: r.shop_name || undefined, logoUrl: r.shop_logo || undefined };
  } catch {
    return {};
  }
}

// ---------- Escrow (fee marketplace sebenarnya) ----------
// order_income = rincian uang order: escrow (yang cair) + semua fee yang dipotong.
export type ShopeeIncome = {
  escrow_amount?: number; // jumlah bersih yang cair ke seller
  commission_fee?: number;
  service_fee?: number;
  seller_transaction_fee?: number;
  credit_card_transaction_fee?: number;
  campaign_fee?: number;
};

// Ambil rincian escrow satu order. Balikin null kalau belum ada (mis. order
// belum dibayar) atau API error — biar sync tetap jalan tanpa fee.
export async function getEscrowDetail(
  accessToken: string,
  shopId: string,
  orderSn: string
): Promise<ShopeeIncome | null> {
  try {
    const r = await shopGet<{ order_income?: ShopeeIncome }>(
      "/api/v2/payment/get_escrow_detail",
      accessToken,
      shopId,
      { order_sn: orderSn }
    );
    return r.order_income ?? null;
  } catch {
    return null;
  }
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
