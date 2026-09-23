import { cookies } from "next/headers";
import { LANG_COOKIE, makeT, parseLang, type Lang, type T } from "./i18n";

export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

// Untuk server component & server action: const { t, lang } = await getT();
export async function getT(): Promise<{ t: T; lang: Lang }> {
  const lang = await getLang();
  return { t: makeT(lang), lang };
}
