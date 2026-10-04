import { createHash, createHmac, randomUUID } from "crypto";

// Blibli Seller API: Basic auth (Client ID:Client Key) + header Api-Seller-Key per toko.
// Docs: https://seller-api.blibli.com/docs
const BASE = process.env.BLIBLI_API_BASE ?? "https://api.blibli.com/v2";
const CHANNEL_ID = process.env.BLIBLI_CHANNEL_ID ?? "pembukuan-marketplace";
const STORE_ID = "10001"; // nilai tetap dari Blibli

export type BlibliCreds = {
  clientId: string;
  clientKey: string;
  sellerKey: string;
  storeCode: string;
  username: string;
  signatureKey?: string | null;
};

export class BlibliError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// format Java "EEE MMM dd HH:mm:ss zz yyyy" di WIB, ex: "Tue May 12 16:28:52 WIB 2020"
function wibDateString(ms: number): string {
  const d = new Date(ms + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(
    d.getUTCMinutes()
  )}:${p(d.getUTCSeconds())} WIB ${d.getUTCFullYear()}`;
}

function signature(key: string, method: string, path: string, body: string | null, ms: number): string {
  const md5 = body ? createHash("md5").update(body).digest("hex") : "";
  const raw = [method, md5, method === "GET" ? "" : "application/json", wibDateString(ms), path].join("\n");
  return createHmac("sha256", key).update(raw).digest("base64");
}

async function request<T>(
  creds: BlibliCreds,
  method: "GET" | "POST",
  path: string, // setelah /proxy, ex: /seller/v1/orders/packages/filter
  opts: { query?: Record<string, string | number>; body?: unknown } = {}
): Promise<T> {
  const q = new URLSearchParams({
    requestId: `${CHANNEL_ID}-${randomUUID()}`,
    storeId: STORE_ID,
    channelId: CHANNEL_ID,
    storeCode: creds.storeCode,
    businessPartnerCode: creds.storeCode,
    merchantCode: creds.storeCode,
    username: creds.username,
  });
  for (const [k, v] of Object.entries(opts.query ?? {})) q.set(k, String(v));

  const body = opts.body == null ? null : JSON.stringify(opts.body);
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientKey}`).toString("base64")}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Api-Seller-Key": creds.sellerKey,
  };
  if (creds.signatureKey) {
    const ms = Date.now();
    headers.Signature = signature(creds.signatureKey, method, path, body, ms);
    headers["Signature-Time"] = String(ms);
  }

  const res = await fetch(`${BASE}/proxy${path}?${q}`, {
    method,
    headers,
    body: body ?? undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: { errorCode?: string; errorMessage?: string } & Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // respons non-JSON (ex: halaman error gateway)
  }

  if (res.status === 429) {
    throw new BlibliError("Batas panggilan API Blibli tercapai, coba lagi sekitar 30 menit lagi.", 429);
  }
  if (res.status === 401 || res.status === 403) {
    throw new BlibliError(
      `Blibli menolak kredensial (${res.status}${json.errorMessage ? `: ${json.errorMessage}` : ""}). Cek Client ID/Key, Seller Key & Store Code.`,
      res.status,
      json.errorCode
    );
  }
  if (!res.ok || json.errorCode) {
    const msg = json.errorMessage || text.slice(0, 200) || res.statusText;
    throw new BlibliError(`Blibli ${path} gagal (${res.status}): ${msg}`, res.status, json.errorCode);
  }
  return json as T;
}

// ---------- Order ----------
export type BlibliOrderItem = {
  createdDate?: number;
  order: {
    id: string;
    itemId: string;
    itemStatus: string;
    quantity: number;
    date: number;
    customerFullName?: string;
    statusFPUpdatedTimestamp?: number;
  };
  product: {
    blibliSku?: string;
    sellerSku?: string;
    itemName?: string;
    price?: number;
    finalPrice?: number;
  };
  storeCode?: string;
};

type Paging = { pageNumber?: number; totalPage?: number; totalRecord?: number };

type OrderListResp = {
  paging?: Paging;
  content?: { packageId?: string; orderItems?: BlibliOrderItem[] }[];
};

const ORDER_PAGE = 50; // maks dari Blibli

// Satu halaman order (dikelompokkan per paket) yang jadi FP dalam rentang ini.
export async function listOrderItems(creds: BlibliCreds, startMs: number, endMs: number, page: number) {
  const r = await request<OrderListResp>(creds, "POST", "/seller/v1/orders/packages/filter", {
    body: {
      filter: { statusFPDateRange: { start: startMs, end: endMs } },
      sorting: { by: "statusFPUpdatedTimestamp", direction: "ASC" },
      paging: { page, size: ORDER_PAGE },
    },
  });
  return {
    items: (r.content ?? []).flatMap((p) => p.orderItems ?? []),
    totalPage: r.paging?.totalPage ?? 1,
    totalRecord: r.paging?.totalRecord ?? 0,
  };
}

// Blibli membatasi hasil filter maks 100 record → rentang yang mentok dipecah dua.
export const ORDER_RECORD_CAP = 100;

export async function fetchOrderItems(creds: BlibliCreds, startMs: number, endMs: number): Promise<BlibliOrderItem[]> {
  const first = await listOrderItems(creds, startMs, endMs, 0);
  if (first.totalRecord >= ORDER_RECORD_CAP && endMs - startMs > 3600_000) {
    const mid = Math.floor((startMs + endMs) / 2);
    return [...(await fetchOrderItems(creds, startMs, mid)), ...(await fetchOrderItems(creds, mid + 1, endMs))];
  }
  const all = [...first.items];
  for (let p = 1; p < first.totalPage; p++) all.push(...(await listOrderItems(creds, startMs, endMs, p)).items);
  return all;
}

// ---------- Settlement (pencairan) ----------
export type BlibliSettlement = {
  settlementId: string;
  status: string;
  paymentDate?: number;
  totalPayment?: number;
  paymentHold?: boolean;
};

export type BlibliSettlementItem = {
  orderItemNo: string;
  sales?: number;
  commission?: number;
  transactionFee?: number;
  paymentFeeBySeller?: number;
  pph23?: number;
  sellerPromo?: number;
  sellerShipping?: number;
  totalPayment?: number;
};

const SETTLEMENT_PAGE = 30; // maks dari Blibli

export async function listSettlements(creds: BlibliCreds, fromMs: number, toMs: number): Promise<BlibliSettlement[]> {
  const out: BlibliSettlement[] = [];
  for (let page = 0; ; page++) {
    const r = await request<{ content?: BlibliSettlement[]; pageMetaData?: Paging }>(
      creds,
      "POST",
      "/seller/v1/settlements/filter",
      {
        query: { page, size: SETTLEMENT_PAGE },
        body: {
          filter: { paymentStartDate: fromMs, paymentEndDate: toMs, status: "PAID" },
          paging: { page, size: SETTLEMENT_PAGE },
        },
      }
    );
    out.push(...(r.content ?? []));
    if (page + 1 >= (r.pageMetaData?.totalPage ?? 1)) return out;
  }
}

export async function settlementItems(creds: BlibliCreds, settlementId: string): Promise<BlibliSettlementItem[]> {
  const out: BlibliSettlementItem[] = [];
  for (let page = 0; ; page++) {
    const r = await request<{ content?: { orderItems?: BlibliSettlementItem[]; pageMetaData?: Paging } }>(
      creds,
      "GET",
      `/seller/v1/settlements/${encodeURIComponent(settlementId)}/orderItems`,
      { query: { page, size: 100 } }
    );
    out.push(...(r.content?.orderItems ?? []));
    if (page + 1 >= (r.content?.pageMetaData?.totalPage ?? 1)) return out;
  }
}

// cek kredensial: 1 panggilan order list 1 hari terakhir
export async function testConnection(creds: BlibliCreds): Promise<void> {
  const now = Date.now();
  await listOrderItems(creds, now - 24 * 3600 * 1000, now, 0);
}
