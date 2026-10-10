"use client";

import { useState, useRef, useEffect, useTransition, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { enGB, id as idLocale } from "date-fns/locale";
import { format, type Locale } from "date-fns";
import { CalendarRange, ChevronDown, Loader2, X } from "lucide-react";
import { useT, useLang } from "@/components/LangProvider";
import type { T } from "@/lib/i18n";
import "react-day-picker/style.css";

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}
function labelDate(d: Date, locale: Locale) {
  return format(d, "d MMM yyyy", { locale });
}

// preset relatif terhadap hari ini
function buildPresets(t: T) {
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
    { key: "today", label: t("Hari ini", "Today"), from: today, to: today },
    { key: "7d", label: t("7 hari terakhir", "Last 7 days"), from: minus(6), to: today },
    { key: "30d", label: t("30 hari terakhir", "Last 30 days"), from: minus(29), to: today },
    { key: "90d", label: t("90 hari terakhir", "Last 90 days"), from: minus(89), to: today },
    { key: "month", label: t("Bulan ini", "This month"), from: firstThisMonth, to: today },
    {
      key: "lastmonth",
      label: t("Bulan lalu", "Last month"),
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
  const t = useT();
  const lang = useLang();
  const dfLocale = lang === "en" ? enGB : idLocale;

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
  // "Semua data" dipilih di popover tapi belum diterapkan
  const [allPicked, setAllPicked] = useState(false);
  const [navPending, startNav] = useTransition();

  // sinkronkan kalender dengan rentang aktif (ex: setelah preset diterapkan)
  useEffect(() => {
    setRange({
      from: new Date(`${fromStr}T00:00:00`),
      to: new Date(`${toStr}T00:00:00`),
    });
    setMonth(new Date(`${toStr}T00:00:00`));
  }, [fromStr, toStr]);

  // HP: tampil sebagai bottom sheet → kunci scroll halaman selama terbuka
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 639px)").matches) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

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
    startNav(() => router.push(`${basePath}?${next.toString()}`, { scroll: false }));
    if (close) setOpen(false);
  }

  // "Semua data" → pakai sentinel all=1 supaya benar-benar tanpa batas tanggal.
  function clearRange() {
    const next = new URLSearchParams(params.toString());
    next.delete("from");
    next.delete("to");
    next.set("all", "1");
    startNav(() => router.push(`${basePath}?${next.toString()}`, { scroll: false }));
    setAllPicked(false);
    setOpen(false);
  }

  function pickAll() {
    setAllPicked(true);
    setRange(undefined);
    setDays("");
  }

  // preview: highlight rentang di kalender tanpa apply. User apply lewat
  // tombol "Terapkan" tunggal di kanan.
  function preview(from: Date, to: Date) {
    setAllPicked(false);
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
    setAllPicked(false);
    setOpen(false);
  }

  const presets = buildPresets(t);
  const buttonLabel = isAll
    ? t("Semua data", "All data")
    : `${labelDate(new Date(`${fromStr}T00:00:00`), dfLocale)} – ${labelDate(new Date(`${toStr}T00:00:00`), dfLocale)}`;

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
      setAllPicked(isAll);
      if (isAll) setRange(undefined); // "semua data" aktif → kalender tanpa sorotan rentang lama
    }
    setOpen((o) => !o);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-auto sm:justify-start"
      >
        <span className="flex min-w-0 items-center gap-2">
          {navPending ? (
            <Loader2 size={16} className="shrink-0 animate-spin text-indigo-500" aria-label={t("Memuat…", "Loading…")} />
          ) : (
            <CalendarRange size={16} className="shrink-0 text-slate-400" />
          )}
          <span className="truncate font-medium">{buttonLabel}</span>
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div
          className="animate-fade fixed inset-0 z-[90] bg-slate-900/40 sm:hidden"
          onClick={(e) => {
            e.preventDefault(); // di dalam <label>: tanpa ini klik diteruskan ke tombol pemicu → terbuka lagi
            cancel();
          }}
          aria-hidden
        />
      )}
      {open && (
        <div
          role="dialog"
          aria-label={t("Rentang tanggal", "Date range")}
          // area kosong/judul di dalam <label> jangan diteruskan ke tombol pemicu
          onClick={(e) => !(e.target as HTMLElement).closest("button, input, a") && e.preventDefault()}
          className={`animate-sheet fixed inset-x-0 bottom-0 z-[95] flex max-h-[88dvh] flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:z-50 sm:mt-2 sm:max-h-none sm:w-auto sm:max-w-[95vw] sm:flex-row sm:overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-xl ${
            alignRight ? "sm:right-0" : "sm:left-0"
          }`}
        >
          <div className="flex items-center justify-between px-5 pb-1 pt-4 sm:hidden">
            <span className="text-sm font-semibold text-slate-900">{t("Rentang tanggal", "Date range")}</span>
            <button
              type="button"
              onClick={cancel}
              aria-label={t("Tutup", "Close")}
              className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
          {/* preset + N hari */}
          <div className="flex flex-col border-b border-slate-100 p-3 sm:w-48 sm:border-b-0 sm:border-r">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("Pilihan cepat", "Quick picks")}
            </p>
            <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-1">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => preview(p.from, p.to)}
                  className="rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 sm:py-1.5"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={pickAll}
                aria-pressed={allPicked}
                className={`rounded-lg px-3 py-2.5 text-left text-sm sm:py-1.5 ${
                  allPicked
                    ? "bg-indigo-50 font-medium text-indigo-700"
                    : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                {t("Semua data", "All data")}
              </button>
            </div>

            <div className="mt-auto border-t border-slate-100 pt-3">
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t("Hari terakhir", "Last days")}
              </p>
              <div className="flex items-center gap-2 px-1">
                <input
                  type="number"
                  min="1"
                  value={days}
                  onChange={(e) => previewLastNDays(e.target.value)}
                  placeholder={t("cth: 14", "e.g. 14")}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="shrink-0 text-xs text-slate-400">{t("hari", "days")}</span>
              </div>
            </div>
          </div>

          {/* kalender custom */}
          <div className="flex flex-col items-center p-3 sm:items-stretch">
            <DayPicker
              mode="range"
              locale={dfLocale}
              selected={range}
              onSelect={(v) => {
                setAllPicked(false);
                setRange(v);
              }}
              month={month}
              onMonthChange={setMonth}
              numberOfMonths={1}
              style={rdpStyle}
              className="text-sm"
            />
            {/* HP: tombol tetap terlihat di bawah walau isi sheet digulir */}
            <div className="sticky bottom-0 mt-auto flex w-full justify-end gap-2 border-t border-slate-100 bg-white pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:pb-0">
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 sm:px-3 sm:py-1.5"
              >
                {t("Batal", "Cancel")}
              </button>
              <button
                type="button"
                disabled={!allPicked && (!range?.from || !range?.to)}
                onClick={() =>
                  allPicked ? clearRange() : range?.from && range?.to && commit(range.from, range.to, true)
                }
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 sm:flex-none sm:py-1.5"
              >
                {t("Terapkan", "Apply")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
