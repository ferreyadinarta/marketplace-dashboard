"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLang } from "@/app/lang-actions";
import { useLang } from "@/components/LangProvider";
import type { Lang } from "@/lib/i18n";

const OPTIONS: { value: Lang; label: string; title: string }[] = [
  { value: "id", label: "ID", title: "Bahasa Indonesia" },
  { value: "en", label: "EN", title: "English" },
];

export function LangToggle() {
  const lang = useLang();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (v: Lang) => {
    if (v === lang) return;
    startTransition(async () => {
      await setLang(v);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2 px-2">
      <Languages size={16} className="shrink-0 text-slate-400" aria-hidden />
      <div
        role="radiogroup"
        aria-label={lang === "en" ? "Language" : "Bahasa"}
        className={`flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold ${pending ? "opacity-60" : ""}`}
      >
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={lang === o.value}
            title={o.title}
            disabled={pending}
            onClick={() => choose(o.value)}
            className={`rounded-md px-2.5 py-1 ${
              lang === o.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
