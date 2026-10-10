"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { useT } from "@/components/LangProvider";

export type SelectOption = { value: string; label: string };

const MOBILE_QUERY = "(max-width: 639px)";

// Dropdown custom penuh: tombol + daftar opsi yang kita render sendiri lewat PORTAL
// (tidak terpotong container overflow). Di HP tampil sebagai bottom sheet: halaman
// dikunci supaya geser daftar tidak menggeser halaman lalu menutup dropdown.
export function Select({
  options,
  name,
  defaultValue,
  value,
  onValueChange,
  placeholder,
  className = "",
  disabled = false,
  searchable = false,
}: {
  options: SelectOption[];
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t("Pilih…", "Select…");
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [internal, setInternal] = useState(defaultValue ?? "");
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxH: number;
  }>();
  // tinggi keyboard HP (visualViewport) → sheet naik di atasnya
  const [kb, setKb] = useState({ bottom: 0, height: 0 });

  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const selected = options.find((o) => o.value === current);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const desired = Math.min(264, options.length * 40 + 8) + (searchable ? 48 : 0);
    const openUp = spaceBelow < desired && spaceAbove > spaceBelow;
    // jangan sampai keluar layar kanan
    const width = Math.max(r.width, Math.min(window.innerWidth * 0.9, 352));
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      width: r.width,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      maxH: Math.max(140, (openUp ? spaceAbove : spaceBelow) - 16 - (searchable ? 48 : 0)),
    });
  }, [options.length, searchable]);

  function toggle() {
    if (disabled) return;
    if (!open) {
      setMobile(window.matchMedia(MOBILE_QUERY).matches);
      place();
      setQuery("");
    }
    setOpen((o) => !o);
  }

  const shown =
    searchable && query.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
      : options;

  // Desktop: klik di luar → tutup; scroll halaman/resize → ikut tombolnya.
  // Scroll di dalam daftar diabaikan.
  useEffect(() => {
    if (!open || mobile) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScroll(e: Event) {
      if (listRef.current?.contains(e.target as Node)) return;
      const r = btnRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return setOpen(false);
      place();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, mobile, place]);

  // HP: kunci scroll halaman & ikuti keyboard selama sheet terbuka
  useEffect(() => {
    if (!open || !mobile) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const vv = window.visualViewport;
    const onVv = () => {
      if (!vv) return;
      setKb({ bottom: Math.max(0, window.innerHeight - vv.height - vv.offsetTop), height: vv.height });
    };
    onVv();
    vv?.addEventListener("resize", onVv);
    vv?.addEventListener("scroll", onVv);
    return () => {
      html.style.overflow = prev;
      vv?.removeEventListener("resize", onVv);
      vv?.removeEventListener("scroll", onVv);
    };
  }, [open, mobile]);

  // Esc menutup; opsi terpilih langsung terlihat saat dibuka
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() =>
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
    );
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function choose(v: string) {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
    setOpen(false);
  }

  const searchBox = searchable && (
    <div className={mobile ? "border-b border-slate-100 px-4 pb-3" : "border-b border-slate-100 p-1.5"}>
      <div className="relative">
        {mobile && <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input
          // di HP jangan langsung buka keyboard (menutupi setengah daftar)
          autoFocus={!mobile}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Cari…", "Search…")}
          className={`w-full rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${
            mobile ? "py-2.5 pl-9 pr-3 text-base" : "px-2.5 py-1.5 text-sm"
          }`}
        />
      </div>
    </div>
  );

  const list = (
    <ul
      role="listbox"
      style={mobile ? undefined : { maxHeight: pos?.maxH }}
      className={`overflow-auto overscroll-contain ${mobile ? "min-h-0 flex-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1" : "p-1"}`}
    >
      {shown.length === 0 ? (
        <li className="px-3 py-3 text-sm text-slate-400">{t("Tidak ada hasil", "No results")}</li>
      ) : (
        shown.map((o) => {
          const active = o.value === current;
          return (
            <li key={o.value || "__empty"} role="option" aria-selected={active}>
              <button
                type="button"
                onClick={() => choose(o.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 text-left ${
                  mobile ? "min-h-12 py-2.5 text-[15px]" : "py-2 text-sm"
                } ${active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-100 active:bg-slate-100"}`}
              >
                <span className={`min-w-0 flex-1 ${mobile ? "" : "truncate"}`}>{o.label}</span>
                {active && <Check size={15} className="shrink-0 text-indigo-600" />}
              </button>
            </li>
          );
        })
      )}
    </ul>
  );

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-slate-400"}`}>
          {selected ? selected.label : resolvedPlaceholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        (mobile
          ? createPortal(
              <div className="fixed inset-0 z-[100]">
                <div className="animate-fade absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
                <div
                  ref={listRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("Pilih", "Choose")}
                  style={{ bottom: kb.bottom, maxHeight: kb.height ? Math.min(kb.height - 24, window.innerHeight * 0.8) : "80dvh" }}
                  className="animate-sheet absolute inset-x-0 flex flex-col rounded-t-2xl bg-white shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
                    <span className="truncate text-sm font-semibold text-slate-900">{t("Pilih", "Choose")}</span>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label={t("Tutup", "Close")}
                      className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {searchBox}
                  {list}
                </div>
              </div>,
              document.body
            )
          : pos &&
            createPortal(
              <div
                ref={listRef}
                style={{
                  position: "fixed",
                  left: pos.left,
                  top: pos.top,
                  bottom: pos.bottom,
                  minWidth: pos.width,
                  maxWidth: "min(90vw, 22rem)",
                }}
                className="animate-pop z-[100] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              >
                {searchBox}
                {list}
              </div>,
              document.body
            ))}
    </div>
  );
}
