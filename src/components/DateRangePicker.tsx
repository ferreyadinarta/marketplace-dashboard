"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { id as localeId } from "date-fns/locale";
import { format } from "date-fns";
import { CalendarRange, ChevronDown } from "lucide-react";
import "react-day-picker/style.css";

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}
function labelDate(d: Date) {
  return format(d, "d MMM yyyy", { locale: localeId });
}

// preset relatif terhadap hari ini
function buildPresets() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minus = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };
  const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  return [
    { key: "today", label: "Hari ini", from: today, to: today },
    { key: "7d", label: "7 hari terakhir", from: minus(6), to: today },
    { key: "30d", label: "30 hari terakhir", from: minus(29), to: today },
    { key: "90d", label: "90 hari terakhir", from: minus(89), to: today },
    { key: "month", label: "Bulan ini", from: firstThisMonth, to: today },
    {
      key: "lastmonth",
      label: "Bulan lalu",
      from: firstLastMonth,
      to: lastLastMonth,
    },
  ];
}

export default function DateRangePicker({
  initialFrom,
  initialTo,
  basePath = "/pembukuan",
  defaultAll = false,
}: {
  initialFrom: string;
  initialTo: string;
  basePath?: string;
  defaultAll?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAll =
    params.get("all") === "1" || (defaultAll && !params.get("from") && !params.get("to"));
  const fromStr = params.get("from") ?? initialFrom;
  const toStr = params.get("to") ?? initialTo;

  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(`${fromStr}T00:00:00`),
    to: new Date(`${toStr}T00:00:00`),
  });
  const [month, setMonth] = useState<Date>(new Date(`${toStr}T00:00:00`));
  const [days, setDays] = useState("");

  // sinkronkan kalender dengan rentang aktif (ex: setelah preset diterapkan)
  useEffect(() => {
    setRange({
      from: new Date(`${fromStr}T00:00:00`),
      to: new Date(`${toStr}T00:00:00`),
    });
    setMonth(new Date(`${toStr}T00:00:00`));
  }, [fromStr, toStr]);

  // tutup saat klik di luar
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // set rentang: highlight kalender + update URL. close=false → popover tetap
  // terbuka supaya user lihat rentang ter-highlight di kalender & label kiri.
  function commit(from: Date, to: Date, close: boolean) {
    setRange({ from, to });
    setMonth(to);
    const next = new URLSearchParams(params.toString());
    next.delete("all");
    next.set("from", ymd(from));
    next.set("to", ymd(to));
    router.push(`${basePath}?${next.toString()}`, { scroll: false });
    if (close) setOpen(false);
  }

  // "Semua data" → pakai sentinel all=1 supaya benar-benar tanpa batas tanggal.
  function clearRange() {
    const next = new URLSearchParams(params.toString());
    next.delete("from");
    next.delete("to");
    next.set("all", "1");
    router.push(`${basePath}?${next.toString()}`, { scroll: false });
    setOpen(false);
  }

  // preview: highlight rentang di kalender tanpa apply. User apply lewat
  // tombol "Terapkan" tunggal di kanan.
  function preview(from: Date, to: Date) {
    setRange({ from, to });
    setMonth(to);
  }

  function previewLastNDays(v: string) {
    setDays(v);
    const n = parseInt(v, 10);
    if (!n || n < 1) return;
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    from.setDate(from.getDate() - (n - 1));
    preview(from, to);
  }

  function cancel() {
    setRange({
      from: new Date(`${fromStr}T00:00:00`),
      to: new Date(`${toStr}T00:00:00`),
    });
    setMonth(new Date(`${toStr}T00:00:00`));
    setDays("");
    setOpen(false);
  }

  const presets = buildPresets();
  const buttonLabel = isAll
    ? "Semua data"
    : `${labelDate(new Date(`${fromStr}T00:00:00`))} – ${labelDate(new Date(`${toStr}T00:00:00`))}`;

  const rdpStyle = {
    "--rdp-accent-color": "#4f46e5",
    "--rdp-accent-background-color": "#eef2ff",
    "--rdp-day-width": "36px",
    "--rdp-day-height": "36px",
    "--rdp-day_button-width": "36px",
    "--rdp-day_button-height": "36px",
    margin: 0,
  } as CSSProperties;

  function toggleOpen() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const approxW = Math.min(640, window.innerWidth * 0.95);
      setAlignRight(r.left + approxW > window.innerWidth - 8);
    }
    setOpen((o) => !o);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      >
        <CalendarRange size={16} className="text-slate-400" />
        <span className="font-medium">{buttonLabel}</span>
        <ChevronDown size={15} className="text-slate-400" />
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-2 flex w-auto max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:flex-row ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {/* preset + N hari */}
          <div className="flex flex-col border-b border-slate-100 p-3 sm:w-48 sm:border-b-0 sm:border-r">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Pilihan cepat
            </p>
            <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-1">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => preview(p.from, p.to)}
                  className="rounded-lg px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={clearRange}
                className="rounded-lg px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                Semua data
              </button>
            </div>

            <div className="mt-auto border-t border-slate-100 pt-3">
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Hari terakhir
              </p>
              <div className="flex items-center gap-2 px-1">
                <input
                  type="number"
                  min="1"
                  value={days}
                  onChange={(e) => previewLastNDays(e.target.value)}
                  placeholder="ex: 14"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="shrink-0 text-xs text-slate-400">hari</span>
              </div>
            </div>
          </div>

          {/* kalender custom */}
          <div className="flex flex-col p-3">
            <DayPicker
              mode="range"
              locale={localeId}
              selected={range}
              onSelect={setRange}
              month={month}
              onMonthChange={setMonth}
              numberOfMonths={1}
              style={rdpStyle}
              className="text-sm"
            />
            <div className="mt-auto flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!range?.from || !range?.to}
                onClick={() =>
                  range?.from && range?.to && commit(range.from, range.to, true)
                }
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
