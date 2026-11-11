// Service worker : garde l'interface en cache pour un démarrage rapide.
// Les données (Supabase) passent toujours par le réseau pour rester à jour.
const VERSION = "pokevibes-v13";
const COQUILLE = ["./", "index.html", "style.css", "app.js", "badges.js", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/embleme-112.png", "icons/favicon-32.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Supabase, images, polices : réseau
  // Réseau d'abord (pour recevoir les mises à jour du site), cache si hors ligne
  e.respondWith(
    fetch(e.request).then((r) => { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); return r; })
      .catch(() => caches.match(e.request))
  );
});
