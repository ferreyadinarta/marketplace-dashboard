"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// Tooltip bantuan lewat PORTAL (tidak terpotong overflow). Hover di desktop,
// tap di HP (dulu cuma hover → di HP tidak bisa dibuka sama sekali).
export function HelpHint({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [pinned, setPinned] = useState(false); // dibuka lewat tap/klik
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean }>();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  function open() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const center = r.left + r.width / 2;
    const clamped = Math.min(Math.max(center, 124), window.innerWidth - 124);
    const above = r.bottom + 120 > window.innerHeight;
    setPos({ left: clamped, top: above ? r.top - 8 : r.bottom + 8, above });
    setShow(true);
  }

  function close() {
    setShow(false);
    setPinned(false);
  }

  useEffect(() => {
    if (!show || !pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close, true);
    };
  }, [show, pinned]);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={text}
      onMouseEnter={open}
      onMouseLeave={() => !pinned && setShow(false)}
      onFocus={open}
      onBlur={close}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pinned) close();
        else {
          open();
          setPinned(true);
        }
      }}
      className="ml-1 inline-flex cursor-help rounded-full align-middle focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
        ?
      </span>
      {mounted &&
        show &&
        pos &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              transform: pos.above ? "translate(-50%, -100%)" : "translateX(-50%)",
            }}
            className="pointer-events-none z-[300] block w-56 max-w-[80vw] rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </button>
  );
}
