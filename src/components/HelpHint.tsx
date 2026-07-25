"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// Tooltip bantuan. Di-render lewat PORTAL ke document.body + posisi fixed,
// jadi tidak pernah terpotong container yang overflow-hidden/auto (mis. tabel).
export function HelpHint({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => setMounted(true), []);

  function enter() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const center = r.left + r.width / 2;
    const clamped = Math.min(Math.max(center, 124), window.innerWidth - 124);
    setPos({ left: clamped, top: r.bottom + 8 });
    setShow(true);
  }

  return (
    <span
      ref={ref}
      onMouseEnter={enter}
      onMouseLeave={() => setShow(false)}
      className="ml-1 inline-flex cursor-help align-middle"
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
        ?
      </span>
      {mounted &&
        show &&
        pos &&
        createPortal(
          <span
            style={{ position: "fixed", left: pos.left, top: pos.top, transform: "translateX(-50%)" }}
            className="pointer-events-none z-[300] block w-56 max-w-[80vw] rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg"
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}
