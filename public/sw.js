/* Only public interface assets. Never store application documents or API data. */
const CACHE = "cercaya-pwa-static-v1";
const ASSETS = ["/pwa/offline.html", "/pwa/icon-192.png", "/pwa/icon-512.png", "/pwa/icon-maskable-512.png", "/pwa/apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async path => {
      const response = await fetch(path, { cache: "reload", credentials: "omit" });
      if (!response.ok || response.redirected) throw new Error("pwa_asset_unavailable");
      await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("cercaya-pwa-static-") && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(async () => {
      const fallback = await caches.match("/pwa/offline.html", { cacheName: CACHE });
      return fallback || new Response("Sin conexión. Necesitás conexión a internet para ver disponibilidad actualizada.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }));
    return;
  }
  if (url.search || !ASSETS.includes(url.pathname) || request.headers.has("Authorization")) return;
  // Network first: refreshed icons remain current, and only these exact public
  // paths are available offline. RSC, JS, CSS, product photos and RPC pass through.
  event.respondWith((async () => {
    try {
      const response = await fetch(url.pathname, { cache: "no-cache", credentials: "omit" });
      if (response.ok && !response.redirected) {
        const cache = await caches.open(CACHE);
        await cache.put(url.pathname, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(url.pathname, { cacheName: CACHE });
      return cached || Response.error();
    }
  })());
});
