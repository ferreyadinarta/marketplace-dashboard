"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, BellOff, Share, Plus, CheckCircle2, AlertCircle } from "lucide-react";
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

type Msg = { tone: "ok" | "err"; text: string } | null;

// Ambil langganan yang ada; kalau kuncinya beda (VAPID diganti) → buang & buat baru.
// Ini mencegah error InvalidStateError saat "Aktifkan" ditekan berulang.
async function getOrCreateSub(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const key = urlBase64ToUint8Array(VAPID);
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    const cur = existing.options?.applicationServerKey;
    const curArr = cur ? new Uint8Array(cur) : null;
    const same = !!curArr && curArr.length === key.length && curArr.every((b, i) => b === key[i]);
    if (same) return existing;
    await existing.unsubscribe(); // kunci lama → tidak dipakai lagi
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

export function NotificationToggle() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);

  // Baca status LANGSUNG dari browser — jangan menebak dari state lokal, supaya
  // tampilan selalu jujur (mis. setelah reload / gagal separuh jalan).
  const refresh = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
      return sub;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    if (!ok) return;
    void (async () => {
      const sub = await refresh();
      // Sudah izin + ada langganan di browser, tapi mungkin belum tersimpan di server
      // (mis. simpan gagal waktu itu) → sinkronkan diam-diam biar notif benar-benar jalan.
      if (sub) {
        try {
          await subscribeUser(JSON.parse(JSON.stringify(sub)));
        } catch {
          /* diamkan: status tetap jujur dari browser */
        }
      }
    })();
  }, [refresh]);

  async function subscribe() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setMsg({ tone: "err", text: "Izin notifikasi ditolak. Aktifkan lewat setelan browser/HP kalau berubah pikiran." });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await getOrCreateSub(reg);
      const res = await subscribeUser(JSON.parse(JSON.stringify(sub)));
      if (!res?.ok) throw new Error(res?.reason || "server menolak langganan");
      setSubscribed(true);
      setMsg({ tone: "ok", text: "Notifikasi aktif di HP ini." });
    } catch (e) {
      const err = e as Error;
      setMsg({ tone: "err", text: `Gagal mengaktifkan: ${err?.message || err?.name || "tidak diketahui"}. Coba lagi.` });
    } finally {
      setBusy(false);
      void refresh(); // pastikan tampilan cocok dengan kondisi asli
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
      setMsg({ tone: "ok", text: "Notifikasi dimatikan di HP ini." });
    } catch (e) {
      const err = e as Error;
      setMsg({ tone: "err", text: `Gagal mematikan: ${err?.message || "tidak diketahui"}.` });
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendTestNotification();
      setMsg(
        r.sent > 0
          ? { tone: "ok", text: "Notifikasi tes dikirim — cek layar HP." }
          : { tone: "err", text: "Tidak terkirim. Belum ada device aktif / kunci VAPID belum di-set di server." }
      );
    } catch (e) {
      setMsg({ tone: "err", text: `Gagal kirim tes: ${(e as Error)?.message || "tidak diketahui"}.` });
    } finally {
      setBusy(false);
    }
  }

  async function cek() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await checkNow();
      setMsg({
        tone: "ok",
        text: r.low > 0 ? `Ada ${r.low} product menipis — cek notifikasi.` : "Stok aman, tidak ada yang menipis.",
      });
    } catch (e) {
      setMsg({ tone: "err", text: `Gagal cek: ${(e as Error)?.message || "tidak diketahui"}.` });
    } finally {
      setBusy(false);
    }
  }

  // tombol nyaman disentuh (min 44px) & rapi di layar kecil
  const btn = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-50";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            subscribed ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
          }`}
        >
          {subscribed ? <BellRing size={18} /> : <Bell size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Notifikasi Stok Menipis</h2>
            {subscribed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 size={12} /> Aktif di HP ini
              </span>
            )}
          </div>
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
          ) : permission === "denied" && !subscribed ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Izin notifikasi diblokir untuk situs ini. Aktifkan dulu lewat setelan HP/browser (Notifications →
              izinkan), lalu buka halaman ini lagi.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {subscribed ? (
                <>
                  <button onClick={cek} disabled={busy} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
                    {busy ? "Memproses…" : "Cek stok sekarang"}
                  </button>
                  <button onClick={test} disabled={busy} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
                    Kirim tes
                  </button>
                  <button onClick={unsubscribe} disabled={busy} className={`${btn} text-slate-500 hover:bg-slate-100`}>
                    <BellOff size={14} className="mr-1" /> Matikan
                  </button>
                </>
              ) : (
                <button onClick={subscribe} disabled={busy} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
                  <Bell size={14} className="mr-1" /> {busy ? "Mengaktifkan…" : "Aktifkan notifikasi"}
                </button>
              )}
            </div>
          )}

          {msg && (
            <p
              className={`mt-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs ${
                msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
              }`}
            >
              {msg.tone === "ok" ? (
                <CheckCircle2 size={14} className="mt-px shrink-0" />
              ) : (
                <AlertCircle size={14} className="mt-px shrink-0" />
              )}
              <span>{msg.text}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
