// PWA service worker: NETWORK-FIRST cho mọi file cùng origin.
// Bản cũ cache-first trả file cũ dù server đã có bản mới, khiến người chơi
// cứ thấy trang đăng nhập / bundle cũ mãi. Bản này ưu tiên mạng, chỉ dùng
// cache khi mất mạng, và đổi tên cache để xóa sạch cache cũ khi kích hoạt.
const CACHE = "tan-online-v2";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch {
      const hit = await c.match(e.request);
      if (hit) return hit;
      throw e;
    }
  })());
});
