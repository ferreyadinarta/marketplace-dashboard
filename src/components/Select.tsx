"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = { value: string; label: string };

// Dropdown custom penuh: tombol + daftar opsi yang kita render sendiri.
// Daftar opsi di-render lewat PORTAL ke document.body + posisi fixed, supaya
// TIDAK terpotong oleh container yang overflow-hidden/auto (ex: tabel).
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
  const [mounted, setMounted] = useState(false);
  const [internal, setInternal] = useState(defaultValue ?? "");
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxH: number;
  }>();

  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const selected = options.find((o) => o.value === current);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const desired = Math.min(264, options.length * 40 + 8);
    const openUp = spaceBelow < desired && spaceAbove > spaceBelow;
    setPos({
      left: r.left,
      width: r.width,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      maxH: Math.max(140, (openUp ? spaceAbove : spaceBelow) - 16),
    });
  }, [options.length]);

  function toggle() {
    if (disabled) return;
    if (!open) place();
    setOpen((o) => !o);
  }

  // tutup saat klik di luar, scroll, atau resize
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScrollResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  function choose(v: string) {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
    setOpen(false);
  }

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
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

      {mounted &&
        open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              minWidth: pos.width,
              maxWidth: "min(90vw, 22rem)",
              maxHeight: pos.maxH,
            }}
            className="z-[100] overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          >
            {options.map((o) => {
              const active = o.value === current;
              return (
                <li key={o.value || "__empty"}>
                  <button
                    type="button"
                    onClick={() => choose(o.value)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      active
                        ? "bg-indigo-50 font-medium text-indigo-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="whitespace-nowrap">{o.label}</span>
                    {active && (
                      <Check size={15} className="shrink-0 text-indigo-600" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
