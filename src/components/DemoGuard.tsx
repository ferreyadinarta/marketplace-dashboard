"use client";

import { useEffect } from "react";
import { useT } from "@/components/LangProvider";
import { DEMO_MESSAGE } from "@/lib/demo";

export function DemoGuard() {
  const t = useT();

  useEffect(() => {
    const message = t(DEMO_MESSAGE.id, DEMO_MESSAGE.en);
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.closest("[data-demo-allow]")) return;
      const submitter = e.submitter as HTMLButtonElement | HTMLInputElement | null;
      const writes =
        form.method.toLowerCase() === "post" ||
        submitter?.formMethod?.toLowerCase() === "post" ||
        !!form.querySelector('input[name^="$ACTION"]') ||
        (form.getAttribute("action") ?? "").startsWith("javascript:");
      if (!writes) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent("app:toast", { detail: message }));
    }

    window.addEventListener("submit", onSubmit, true);
    return () => window.removeEventListener("submit", onSubmit, true);
  }, [t]);

  return null;
}
