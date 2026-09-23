"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/components/LangProvider";

type Toast = { id: number; msg: string; leaving: boolean };

// Toaster global: dengarkan event window "app:toast" (detail = pesan) lalu tampilkan
// notifikasi kecil di kanan-bawah dengan animasi masuk & keluar.
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const t = useT();

  useEffect(() => {
    let n = 0;
    function onToast(e: Event) {
      const msg = String((e as CustomEvent).detail ?? t("Tersimpan", "Saved"));
      const id = ++n;
      setToasts((t) => [...t, { id, msg, leaving: false }]);
      // mulai animasi keluar setelah 2.5s
      window.setTimeout(() => {
        setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      }, 2500);
      // hapus dari DOM setelah animasi keluar selesai
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 2820);
    }
    window.addEventListener("app:toast", onToast);
    return () => window.removeEventListener("app:toast", onToast);
  }, [t]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[400] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} msg={t.msg} leaving={t.leaving} />
      ))}
    </div>
  );
}

function ToastItem({ msg, leaving }: { msg: string; leaving: boolean }) {
  const [entered, setEntered] = useState(false);

  // trigger animasi masuk pada frame berikutnya setelah mount
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const visible = entered && !leaving;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-300 ease-out ${
        visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
      }`}
    >
      <CheckCircle2 size={16} className="text-emerald-400" /> {msg}
    </div>
  );
}

// helper opsional untuk memicu toast dari client mana pun
export function toast(msg: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:toast", { detail: msg }));
  }
}
