"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("id");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

// Untuk client component: const t = useT();
export function useT() {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}
