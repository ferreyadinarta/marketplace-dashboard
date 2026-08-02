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
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.svg",
    badge: "/icon.svg",
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
