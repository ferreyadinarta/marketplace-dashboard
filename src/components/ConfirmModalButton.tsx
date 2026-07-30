"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";

type Action = (formData: FormData) => void | Promise<void>;

// Tombol pemicu + modal konfirmasi (portal) untuk aksi hapus yang berbahaya.
export function ConfirmModalButton({
  action,
  id,
  trigger,
  triggerClassName = "",
  title,
  message,
  confirmText = "Hapus",
}: {
  action: Action;
  id: string;
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  message: ReactNode;
  confirmText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {trigger}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden />
            <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{message}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <form action={action}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton variant="danger" pendingText="Menghapus…">
                    {confirmText}
                  </SubmitButton>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
