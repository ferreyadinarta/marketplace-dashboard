"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, safeEqual, SESSION_COOKIE } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { t } = await getT();
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD ?? "";
  const secret = process.env.AUTH_SECRET ?? "";

  if (!expected || !secret) {
    return {
      error: t(
        "Konfigurasi auth belum lengkap (APP_PASSWORD / AUTH_SECRET).",
        "Auth configuration incomplete (APP_PASSWORD / AUTH_SECRET).",
      ),
    };
  }
  if (!safeEqual(password, expected)) {
    return { error: t("Password salah. Coba lagi.", "Wrong password. Try again.") };
  }

  // Ingat saya: cookie tahan lama (60 hari). Kalau tidak: cookie sesi
  // (hilang saat browser ditutup) + token pendek (1 hari).
  const remember = formData.get("remember") === "on";
  const ttl = remember ? 60 * 60 * 24 * 60 : 60 * 60 * 24;
  const token = await createSession(secret, ttl);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: ttl } : {}),
  });

  const nextRaw = String(formData.get("next") ?? "/");
  const next = nextRaw.startsWith("/") ? nextRaw : "/";
  redirect(next);
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
