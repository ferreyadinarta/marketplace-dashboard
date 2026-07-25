// Auth sederhana berbasis 1 password bersama (shared password).
// Cookie sesi = token bertanda-tangan HMAC (tanpa DB). Berjalan di Edge (middleware)
// maupun Node (server action) karena pakai Web Crypto (crypto.subtle).

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(sig);
}

// perbandingan waktu-konstan sederhana
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const DEFAULT_TTL = 60 * 60 * 24 * 30; // 30 hari

export async function createSession(secret: string, ttlSec = DEFAULT_TTL): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return `${exp}.${await hmac(secret, String(exp))}`;
}

export async function verifySession(secret: string, token: string | undefined): Promise<boolean> {
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(secret, expStr);
  return safeEqual(sig, expected);
}

export const SESSION_COOKIE = "session";
