// Service worker: terima push dari server → tampilkan notifikasi.
// Klik notifikasi → buka halaman Stok.
self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Pembukuan", body: event.data.text() };
  }
  // Android tidak bisa render SVG di notifikasi → ikonnya jadi kotak putih.
  // icon  = PNG berwarna (ikon aplikasi)
  // badge = PNG putih transparan; Android cuma pakai bentuknya (alpha)
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/badge-96.png",
    vibrate: [100, 50, 100],
    tag: data.tag || "stok-menipis",
    renotify: true,
    data: { url: data.url || "/stok" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "Pembukuan", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/stok";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // fokus tab yang sudah terbuka kalau ada, else buka baru
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
