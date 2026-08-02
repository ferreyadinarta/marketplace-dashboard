"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, BellOff, Share, Plus } from "lucide-react";
import { subscribeUser, unsubscribeUser, sendTestNotification, checkNow } from "@/app/(app)/stok/push-actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function NotificationToggle() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    if (!ok) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function subscribe() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Izin notifikasi ditolak. Aktifkan lewat setelan browser kalau berubah pikiran.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const res = await subscribeUser(JSON.parse(JSON.stringify(sub)));
      if (res.ok) {
        setSubscribed(true);
        setMsg("Notifikasi aktif di HP ini.");
      } else setMsg("Gagal menyimpan langganan. Coba lagi.");
    } catch {
      setMsg("Gagal mengaktifkan. Pastikan pakai HTTPS & (di iPhone) buka dari ikon Home Screen.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeUser(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Notifikasi dimatikan di HP ini.");
    } catch {
      setMsg("Gagal mematikan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendTestNotification();
      setMsg(r.sent > 0 ? "Notifikasi tes dikirim." : "Belum ada device aktif / push belum dikonfigurasi.");
    } finally {
      setBusy(false);
    }
  }

  async function cek() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await checkNow();
      setMsg(r.low > 0 ? `Ada ${r.low} product menipis — cek notifikasi.` : "Stok aman, tidak ada yang menipis.");
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {subscribed ? <BellRing size={18} /> : <Bell size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Notifikasi Stok Menipis</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Dapat notifikasi di HP saat ada product yang stoknya menipis atau habis. Dicek otomatis tiap hari.
          </p>

          {!VAPID ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Fitur belum dikonfigurasi (kunci VAPID belum di-set di server).
            </p>
          ) : !supported ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Browser ini tidak mendukung notifikasi push.
            </p>
          ) : isIOS && !standalone ? (
            <div className="mt-3 rounded-lg bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
              Di iPhone, notifikasi cuma jalan kalau app dibuka dari Home Screen. Caranya: tap{" "}
              <Share size={12} className="mb-0.5 inline" /> lalu <b>Add to Home Screen</b>{" "}
              <Plus size={12} className="mb-0.5 inline" />, buka dari ikonnya, baru aktifkan di sini.
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {subscribed ? (
                <>
                  <button onClick={unsubscribe} disabled={busy} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
                    <BellOff size={14} className="mr-1 inline" /> Matikan
                  </button>
                  <button onClick={cek} disabled={busy} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
                    Cek stok sekarang
                  </button>
                  <button onClick={test} disabled={busy} className={`${btn} text-slate-500 hover:bg-slate-100`}>
                    Kirim tes
                  </button>
                </>
              ) : (
                <button onClick={subscribe} disabled={busy} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
                  <Bell size={14} className="mr-1 inline" /> Aktifkan notifikasi
                </button>
              )}
            </div>
          )}

          {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
