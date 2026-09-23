"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE, parseLang } from "@/lib/i18n";

export async function setLang(value: string) {
  (await cookies()).set(LANG_COOKIE, parseLang(value), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
