/* Service worker: guarda la app y las librerías para abrirla sin internet.
   Sube VERSION cuando cambie cualquier archivo de la app. */
const VERSION = "cifrados-v12";
const APP = ["./", "index.html", "cifrado.js", "datos.js", "senas.js", "config.publico.js", "manifest.webmanifest", "favicon.png", "apple-touch-icon.png", "icono-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"];
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com)\//;
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname.endsWith("supabase.co")) return; // datos: los maneja datos.js
  if (CDN.test(e.request.url)) { // librerías con versión fija: primero caché
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return res; })));
    return;
  }
  if (u.origin === location.origin) { // la app: primero red sin caché del navegador (para recibir cambios), si no hay red, la copia guardada
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return res; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
  }
});
