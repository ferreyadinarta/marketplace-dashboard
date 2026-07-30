"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Ingat filter terakhir per halaman (disimpan di localStorage).
// Saat halaman dibuka tanpa param & ada filter tersimpan → pulihkan.
// Reset (URL kosong disengaja) juga tersimpan sebagai kosong → tidak dipulihkan lagi.
export function RememberFilters({ storageKey }: { storageKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const restored = useRef(false);

  // pulihkan sekali saat mount kalau URL kosong
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!params.toString()) {
      const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (saved) router.replace(`${pathname}?${saved}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // simpan setiap kali filter berubah
  useEffect(() => {
    if (!restored.current) return;
    localStorage.setItem(storageKey, params.toString());
  }, [params, storageKey]);

  return null;
}
