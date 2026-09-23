"use client";

import { Suspense, useEffect, useState } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { login, type LoginState } from "./actions";
import { Logo, inputClass, Checkbox } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { LangToggle } from "@/components/LangToggle";
import { useT } from "@/components/LangProvider";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);
  const t = useT();

  // bangunkan compute Neon sambil user mengetik, biar halaman pertama tidak kena cold start
  useEffect(() => {
    void fetch("/api/health?db=1", { cache: "no-store" }).catch(() => {});
  }, []);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t("Password", "Password")}</span>
        <div className="relative">
          <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="password"
            type={show ? "text" : "password"}
            autoFocus
            placeholder={t("Masukkan password", "Enter password")}
            className={`${inputClass} pl-9 pr-10`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t("Sembunyikan password", "Hide password") : t("Lihat password", "Show password")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      <Checkbox name="remember" defaultChecked label={t("Ingat saya di perangkat ini", "Remember me on this device")} />

      {state.error && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle size={15} className="shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton variant="primary" className="w-full" pendingText={t("Memeriksa…", "Checking…")}>
        {t("Masuk", "Log in")}
      </SubmitButton>
    </form>
  );
}

export default function LoginPage() {
  const t = useT();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="absolute right-4 top-4">
        <LangToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={52} />
          <div>
            <h1 className="text-lg font-bold text-slate-900">{t("Pembukuan Marketplace", "Marketplace Bookkeeping")}</h1>
            <p className="text-sm text-slate-500">{t("Masuk untuk melanjutkan", "Log in to continue")}</p>
          </div>
        </div>

        <Suspense fallback={<div className="h-52 rounded-2xl border border-slate-200 bg-white shadow-sm" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-center text-xs text-slate-400">
          {t("Akses internal • Shopee · TikTok · Tokopedia", "Internal access • Shopee · TikTok · Tokopedia")}
        </p>
      </div>
    </div>
  );
}
