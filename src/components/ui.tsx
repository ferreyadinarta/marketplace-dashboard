import Link from "next/link";
import type { ReactNode } from "react";
import { ShoppingBag, Check } from "lucide-react";

export { Select, type SelectOption } from "./Select";
import { HelpHint } from "./HelpHint";
export { HelpHint };

// ---------- Logo (brand mark) ----------
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <ShoppingBag size={Math.round(size * 0.62)} strokeWidth={2.4} />
    </div>
  );
}

// ---------- Card ----------
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    // HP: judul di atas, kontrol selebar kartu di bawahnya (kalau sebaris, dua-duanya tergencet)
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="w-full sm:w-auto sm:shrink-0">{action}</div>}
    </div>
  );
}

// ---------- Page header ----------
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Badge ----------
const badgeColors: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  brand: "bg-indigo-100 text-indigo-700",
};

export function Badge({
  children,
  color = "slate",
}: {
  children: ReactNode;
  color?: keyof typeof badgeColors;
}) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColors[color]}`}>
      {children}
    </span>
  );
}

// ---------- Empty state ----------
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-slate-300">{icon}</div>}
      <div>
        <p className="font-medium text-slate-700">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Buttons (as link or button) ----------
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnVariants: Record<string, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  outline: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "text-red-600 hover:bg-red-50",
};

export function Button({
  children,
  variant = "primary",
  type = "submit",
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof btnVariants;
  type?: "submit" | "button";
  className?: string;
}) {
  return (
    <button type={type} className={`${btnBase} ${btnVariants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  href: string;
  variant?: keyof typeof btnVariants;
  className?: string;
}) {
  return (
    <Link href={href} className={`${btnBase} ${btnVariants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

// HelpHint di-import dari ./HelpHint (client, portal-based) dan dipakai Field.

// ---------- Field wrapper for forms ----------
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center text-xs font-medium text-slate-600">
        {label}
        {hint && <HelpHint text={hint} />}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

// appearance-none menghapus chrome bawaan OS (panah select, styling default).
export const inputClass =
  "w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 [color-scheme:light]";

// tambahan class saat field error
export const inputErrorClass = "border-red-400 focus:border-red-500 focus:ring-red-100";

// ---------- Custom Checkbox ----------
export function Checkbox({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
}) {
  return (
    <label className="group inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
      <span className="relative inline-flex">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <Check
          size={14}
          strokeWidth={3}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label}
    </label>
  );
}
