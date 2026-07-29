import crypto from "crypto";

// Tanda tangan request TikTok Shop Open API (skema v2).
// Algoritma:
//   1. Ambil semua query param KECUALI `sign` dan `access_token`, urutkan by key.
//   2. Gabung jadi "{key}{value}" berurutan, diawali request path.
//   3. Kalau ada body JSON, tempel body-nya.
//   4. Bungkus dengan app_secret di depan & belakang.
//   5. HMAC-SHA256 (key = app_secret), hasil hex.
//
// CATATAN: detail persisnya perlu diverifikasi saat test dengan response nyata.
export function signRequest(
  path: string,
  params: Record<string, string>,
  appSecret: string,
  body?: string
): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();

  let base = path;
  for (const k of keys) base += `${k}${params[k]}`;
  if (body) base += body;

  const wrapped = `${appSecret}${base}${appSecret}`;
  return crypto.createHmac("sha256", appSecret).update(wrapped, "utf8").digest("hex");
}

export function nowTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}
