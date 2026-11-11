// Service worker : garde l'interface en cache pour un démarrage rapide.
// Les données (Supabase) passent toujours par le réseau pour rester à jour.
const VERSION = "pokevibes-v14";
// Tous les fichiers de l'interface, à l'adresse exacte où la page les demande (avec ?v=…).
// tests/modules.test.js vérifie que cette liste est complète et à la bonne version.
const COQUILLE = [
  "./", "index.html", "style.css?v=14", "app.js?v=14",
  "badges.js?v=14", "config.js?v=14", "js/animations.js?v=14", "js/badges-regles.js?v=14",
  "js/badges-ui.js?v=14", "js/catalogue.js?v=14", "js/classeur.js?v=14", "js/collection.js?v=14",
  "js/commun.js?v=14", "js/connexion.js?v=14", "js/equipage.js?v=14", "js/etat.js?v=14",
  "js/fiche.js?v=14", "js/format.js?v=14", "js/navigation.js?v=14", "js/prix.js?v=14",
  "js/progression.js?v=14", "js/recherche.js?v=14", "js/scanner.js?v=14", "js/theme.js?v=14",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/embleme-112.png",
  "icons/favicon-32.png", "icons/apple-touch-icon.png",
];

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
