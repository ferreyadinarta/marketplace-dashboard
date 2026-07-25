"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = { value: string; label: string };

// Dropdown custom penuh: tombol + daftar opsi yang kita render sendiri.
// Tidak memakai <select> native, jadi daftar opsi tidak lagi tampil ala OS.
// Tetap kompatibel dengan <form> lewat <input type="hidden">.
export function Select({
  options,
  name,
  defaultValue,
  value,
  onValueChange,
  placeholder = "Pilih…",
  className = "",
  disabled = false,
}: {
  options: SelectOption[];
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue ?? "");
  const ref = useRef<HTMLDivElement>(null);

  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const selected = options.find((o) => o.value === current);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(v: string) {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 ${className}`}
      >
        <span className={`truncate ${selected ? "" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((o) => {
            const active = o.value === current;
            return (
              <li key={o.value || "__empty"}>
                <button
                  type="button"
                  onClick={() => choose(o.value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                    active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="whitespace-nowrap">{o.label}</span>
                  {active && <Check size={15} className="shrink-0 text-indigo-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
