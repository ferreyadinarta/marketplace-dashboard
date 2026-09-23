// Dua bahasa, tanpa library: teks ditulis berpasangan di tempat dipakai,
// t("Simpan", "Save"). Bahasa disimpan di cookie supaya server & client sama.
export type Lang = "id" | "en";
export const LANG_COOKIE = "lang";

export type T = (id: string, en: string) => string;

export function makeT(lang: Lang): T {
  return (id, en) => (lang === "en" ? en : id);
}

export function parseLang(v: string | undefined | null): Lang {
  return v === "en" ? "en" : "id";
}

// locale untuk Intl (tanggal/angka). Rupiah tetap format Indonesia.
export function intlLocale(lang: Lang): string {
  return lang === "en" ? "en-GB" : "id-ID";
}
