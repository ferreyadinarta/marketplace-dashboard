import { createSign } from "crypto";
import { AKULAKU } from "./config";

// Body JSON dengan key terurut (aturan tanda tangan Akulaku). bigint ditulis apa adanya:
// shopId 19 digit melebihi batas angka JS.
export function stableJson(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stableJson(x)}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

// angka ≥16 digit dibaca sebagai string supaya tidak berubah (shopId, venderId)
export function parseJsonSafe<T>(text: string): T {
  return JSON.parse(text.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"')) as T;
}

function pem(key: string): string {
  if (key.includes("BEGIN")) return key.replace(/\\n/g, "\n");
  const body = key.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

// SHA256withRSA atas base64(app-id=..&timestamp=..&body)
export function signRequest(appId: string, timestamp: string, body: string, privateKey: string): string {
  const content = `app-id=${appId}&timestamp=${timestamp}&${body}`;
  return createSign("RSA-SHA256").update(Buffer.from(content).toString("base64")).sign(pem(privateKey), "base64");
}

export class AkulakuError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

const WHITELIST_CODES = ["10110110100029", "10610910100030"];

// lewat proxy IP tetap kalau di-set (Vercel tidak punya IP keluar yang tetap)
async function send(url: string, init: RequestInit): Promise<{ status: number; text: string }> {
  const signal = AbortSignal.timeout(20_000);
  if (AKULAKU.proxyUrl) {
    const { fetch: proxied, ProxyAgent } = await import("undici");
    const res = await proxied(url, {
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body as string | undefined,
      dispatcher: new ProxyAgent(AKULAKU.proxyUrl),
      signal,
    });
    return { status: res.status, text: await res.text() };
  }
  const res = await fetch(url, { ...init, signal });
  return { status: res.status, text: await res.text() };
}

type Envelope<T> = { success?: boolean; errCode?: string | number | null; errMsg?: string | null; data?: T };

function check<T>(path: string, status: number, text: string): Envelope<T> {
  let json: Envelope<T>;
  try {
    json = parseJsonSafe<Envelope<T>>(text);
  } catch {
    throw new AkulakuError(`Akulaku ${path} gagal (${status}): ${text.slice(0, 200)}`);
  }
  if (json.success === false || status >= 400) {
    const code = json.errCode != null ? String(json.errCode) : undefined;
    if (code && WHITELIST_CODES.includes(code)) {
      throw new AkulakuError(
        "Akulaku menolak IP server (belum di-whitelist). Pastikan AKULAKU_PROXY_URL di-set dan IP proxy-nya sudah didaftarkan di console Akulaku.",
        code
      );
    }
    throw new AkulakuError(`Akulaku ${path} gagal (${code ?? status}): ${json.errMsg ?? text.slice(0, 200)}`, code);
  }
  return json;
}

// ---------- Token aplikasi (berlaku ±2 jam, satu untuk semua toko) ----------
export type AkulakuToken = { accessToken: string; refreshToken: string; expiresIn: number };

export async function getAppToken(refreshToken?: string): Promise<AkulakuToken> {
  const q = new URLSearchParams({
    client_id: AKULAKU.clientId,
    client_secret: AKULAKU.clientSecret,
    scope: "select",
    grant_type: refreshToken ? "refresh_token" : "client_credentials",
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  });
  const path = "/oapi/auth/oauth/token";
  const r = await send(`${AKULAKU.host}${path}?${q}`, { method: "GET" });
  const j = check<{ access_token: string; refresh_token: string; expires_in: number }>(path, r.status, r.text);
  if (!j.data?.access_token) throw new AkulakuError("Akulaku tidak mengembalikan access_token.");
  return { accessToken: j.data.access_token, refreshToken: j.data.refresh_token, expiresIn: j.data.expires_in ?? 7199 };
}

async function post<T>(path: string, accessToken: string, payload: Record<string, unknown>): Promise<T> {
  const body = stableJson(payload);
  const timestamp = String(Date.now());
  const r = await send(`${AKULAKU.host}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "app-id": AKULAKU.appId,
      "access-token": accessToken,
      timestamp,
      sign: signRequest(AKULAKU.appId, timestamp, body, AKULAKU.privateKey),
    },
    body,
  });
  return check<T>(path, r.status, r.text).data as T;
}

// ---------- Toko ----------
export function getAuthorizeUrl(): string {
  const p = new URLSearchParams({
    siteName: "ec",
    clientId: AKULAKU.clientId,
    responseType: "code",
    scope: "all",
    redirectUri: AKULAKU.redirectUrl,
  });
  return `${AKULAKU.loginHost}/login?${p}`;
}

export async function getShopInfo(accessToken: string, shopId: string) {
  return post<{ shopName?: string; logoImg?: string } | undefined>("/v1/open/shop/basic/getShopInfo", accessToken, {
    shopId: BigInt(shopId),
  });
}

// ---------- Order ----------
export type AkulakuOrderItem = {
  id: number | string;
  skuId?: number | string;
  apiSkuId?: string | null;
  skuName?: string;
  skuSpecValues?: string | null;
  skuPrice?: number;
  skuSalePrice?: number;
  qty?: number;
  orderItemAmount?: number;
  refundStatus?: number;
  goodsInfos?: { goodsNo?: string | null }[] | null;
};

export type AkulakuOrder = {
  orderId: number | string;
  orderCode?: string;
  createTime: string;
  orderStatus: number;
  skuTotalAmount?: number;
  orderTotalAmount?: number;
  refundTotalAmount?: number;
  incomeAmount?: number | null;
  settlementAmount?: number | null;
  settlementTime?: string | null;
  settlementStatus?: number | null;
  platformFee?: number | null;
  financialServiceFee?: number | null;
  codServiceFee?: number | null;
  orderMarketingFee?: number | null;
  orderTaxAmount?: number | null;
  orderItemList?: AkulakuOrderItem[];
  receiverAddress?: { name?: string } | null;
};

const PAGE = 30; // maks dari Akulaku

// Order yang TERAKHIR BERUBAH di rentang ini (termasuk yang baru cair)
export async function listOrdersUpdated(
  accessToken: string,
  shopId: string,
  startMs: number,
  endMs: number
): Promise<AkulakuOrder[]> {
  const out: AkulakuOrder[] = [];
  for (let pageNo = 1; ; pageNo++) {
    const d = await post<{ totalPages?: number; result?: AkulakuOrder[] }>("/v1/open/order/list", accessToken, {
      shopId: BigInt(shopId),
      startUpdateTime: startMs,
      endUpdateTime: endMs,
      pageNo,
      pageSize: PAGE,
    });
    out.push(...(d?.result ?? []));
    if (pageNo >= (d?.totalPages ?? 1) || !d?.result?.length) return out;
  }
}
