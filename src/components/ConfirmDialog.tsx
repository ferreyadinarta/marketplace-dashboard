"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SubmitButton } from "@/components/SubmitButton";
import { useT } from "@/components/LangProvider";

type Action = (formData: FormData) => void | Promise<void>;

// Dialog konfirmasi bersama: bottom-sheet di HP, kartu tengah di desktop.
// Pakai animasi masuk (fade backdrop + naik/scale panel) supaya terasa dibuat
// dengan sengaja — bukan modal template generik.
export function ConfirmDialog({
  open,
  onClose,
  action,
  id,
  title,
  message,
  confirmText,
  confirmIcon,
  busyText,
  tone = "danger",
  extraFields,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  action?: Action;
  id?: string; // opsional: aksi massal kirim datanya lewat extraFields
  title: string;
  message: ReactNode;
  confirmText?: string;
  confirmIcon?: ReactNode;
  busyText?: string;
  tone?: "danger" | "primary";
  extraFields?: ReactNode; // input tersembunyi tambahan untuk form konfirmasi
  onConfirm?: () => void; // dipakai kalau konfirmasi TIDAK submit form sendiri (mis. cuma ubah state)
}) {
  const t = useT();
  const resolvedConfirmText = confirmText ?? t("Hapus", "Delete");
  const resolvedBusyText = busyText ?? t("Menghapus…", "Deleting…");
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => setShow(true));
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      setShow(false);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const accent = tone === "danger" ? "bg-red-500" : "bg-indigo-500";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      {/* backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full overflow-hidden rounded-t-2xl bg-white shadow-[0_-8px_40px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-200 transition-all duration-200 ease-out sm:max-w-md sm:rounded-2xl sm:shadow-[0_24px_70px_-20px_rgba(15,23,42,0.45)] ${
          show
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-[0.97]"
        }`}
      >
        {/* garis aksen tipis sesuai tone */}
        <div className={`h-1 w-full ${accent}`} />

        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pt-5">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          <div className="mt-1.5 text-sm leading-relaxed text-slate-500">{message}</div>
        </div>

        <div className="flex gap-2.5 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:flex-none"
          >
            {t("Batal", "Cancel")}
          </button>
          {onConfirm ? (
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition sm:flex-none ${
                tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {resolvedConfirmText}
            </button>
          ) : (
            <form action={action} className="flex-1 sm:flex-none">
              {id !== undefined && <input type="hidden" name="id" value={id} />}
              {extraFields}
              <SubmitButton
                variant={tone}
                icon={confirmIcon}
                pendingText={resolvedBusyText}
                className="w-full"
              >
                {resolvedConfirmText}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
