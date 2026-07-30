"use client";

import { useState } from "react";

const nf = new Intl.NumberFormat("id-ID");

function toDigits(s: string): string {
  return s.replace(/\D/g, "");
}
function display(digits: string): string {
  return digits ? nf.format(Number(digits)) : "";
}

// Input Rupiah dengan pemisah ribuan otomatis saat mengetik (mis. 200000 → 200.000).
// Mode form: beri `name` → nilai ANGKA MENTAH dikirim lewat hidden input (server action baca angka).
// Mode controlled: beri `value` (number) + `onValueChange` (dipakai di form multi-item).
export function CurrencyInput({
  name,
  defaultValue,
  value,
  onValueChange,
  placeholder = "0",
  className = "",
  prefix = "Rp",
}: {
  name?: string;
  defaultValue?: number;
  value?: number;
  onValueChange?: (n: number) => void;
  placeholder?: string;
  className?: string;
  prefix?: string;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string>(
    defaultValue != null && defaultValue > 0 ? String(defaultValue) : ""
  );
  const digits = controlled ? (value ? String(value) : "") : internal;

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const d = toDigits(e.target.value);
    if (!controlled) setInternal(d);
    onValueChange?.(d ? Number(d) : 0);
  }

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={digits} />}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        {prefix}
      </span>
      <input
        inputMode="numeric"
        value={display(digits)}
        onChange={handle}
        placeholder={placeholder}
        className={`w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${className}`}
      />
    </div>
  );
}
