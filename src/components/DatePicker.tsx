"use client";

import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { id as localeId } from "date-fns/locale";
import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import "react-day-picker/style.css";

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}
function labelDate(d: Date) {
  return format(d, "d MMM yyyy", { locale: localeId });
}

// Date picker satu-tanggal, custom penuh (bukan input date bawaan OS).
// Nilai disimpan di hidden input (name) format YYYY-MM-DD supaya kebaca form action.
export function DatePicker({
  name,
  defaultValue,
  className = "",
}: {
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [month, setMonth] = useState<Date>(
    defaultValue ? new Date(`${defaultValue}T00:00:00`) : new Date()
  );
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Kalender di-portal ke body + position:fixed supaya tidak kepotong parent
  // yang punya overflow-hidden (dialog Rekonsiliasi, wrapper tabel yang scroll).
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const w = popRef.current?.offsetWidth ?? 320;
      const h = popRef.current?.offsetHeight ?? 380;
      const M = 8;
      const spaceBelow = window.innerHeight - r.bottom;
      const up = spaceBelow < h + M && r.top > spaceBelow;
      const top = up
        ? Math.max(M, r.top - h - M)
        : Math.min(r.bottom + M, Math.max(M, window.innerHeight - h - M));
      const left = Math.max(M, Math.min(r.left, window.innerWidth - w - M));
      setPos({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function toggle() {
    setOpen((o) => {
      if (o) setPos(null);
      return !o;
    });
  }

  function pick(d?: Date) {
    if (!d) return;
    setValue(ymd(d));
    setMonth(d);
    setOpen(false);
    setPos(null);
  }

  const rdpStyle = {
    "--rdp-accent-color": "#4f46e5",
    "--rdp-accent-background-color": "#eef2ff",
    "--rdp-day-width": "36px",
    "--rdp-day-height": "36px",
    "--rdp-day_button-width": "36px",
    "--rdp-day_button-height": "36px",
    margin: 0,
  } as CSSProperties;

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${className}`}
      >
        <span className="flex items-center gap-2">
          <CalendarDays size={16} className="shrink-0 text-slate-400" />
          <span className={selected ? "text-slate-900" : "text-slate-400"}>
            {selected ? labelDate(selected) : "Pilih tanggal…"}
          </span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-[300] w-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            <DayPicker
              mode="single"
              locale={localeId}
              selected={selected}
              onSelect={pick}
              month={month}
              onMonthChange={setMonth}
              numberOfMonths={1}
              style={rdpStyle}
              className="text-sm"
            />
          </div>,
          document.body
        )}
    </div>
  );
}
