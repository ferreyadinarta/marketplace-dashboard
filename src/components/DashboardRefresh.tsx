"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Auto-refresh diam-diam TANPA polling timer: data diperbarui saat user kembali
// ke tab (visibility/focus), dibatasi 1x / 15 detik. Tidak ada kerja di background
// → tidak boros saat tab tidak dipakai. Tidak menampilkan UI apa pun.
export default function DashboardRefresh() {
  const router = useRouter();
  const lastRef = useRef(0);

  useEffect(() => {
    function onReturn() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRef.current < 15000) return;
      lastRef.current = Date.now();
      router.refresh();
    }
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [router]);

  return null;
}
