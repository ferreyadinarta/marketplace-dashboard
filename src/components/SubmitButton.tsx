"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

const variants: Record<string, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  outline: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-slate-600 hover:bg-slate-100",
};

// Tombol submit dengan status loading otomatis (pakai useFormStatus).
// Saat form sedang submit: tampil spinner, tombol disable, teks berubah.
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  icon,
  disabled = false,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof variants;
  className?: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${className}`}
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : icon}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
