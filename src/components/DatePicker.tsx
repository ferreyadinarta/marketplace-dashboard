"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
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
  const [alignRight, setAlignRight] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [value, setValue] = useState(defaultValue ?? "");
  const [month, setMonth] = useState<Date>(
    defaultValue ? new Date(`${defaultValue}T00:00:00`) : new Date()
  );
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setAlignRight(r.left + 320 > window.innerWidth - 8);
      const spaceBelow = window.innerHeight - r.bottom;
      setOpenUp(spaceBelow < 380 && r.top > spaceBelow);
    }
    setOpen((o) => !o);
  }

  function pick(d?: Date) {
    if (!d) return;
    setValue(ymd(d));
    setMonth(d);
    setOpen(false);
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

      {open && (
        <div
          className={`absolute z-50 w-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ${
            alignRight ? "right-0" : "left-0"
          } ${openUp ? "bottom-full mb-2" : "top-full mt-2"}`}
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
        </div>
      )}
    </div>
  );
}
