/* PokeVibes — Animations d'entrée (référence : docs/animation-reference.html) et « text roll ». */
import { $, calme, esc, PC } from "./commun.js?v=16";

/* ================= Animations d'entrée =================
   Référence validée : docs/animation-reference.html (inspiration vastworld.ai).
   - Tout est visible par défaut : chaque animation part de l'état caché avec fill:"backwards",
     donc si le JavaScript plante, rien ne reste caché. Rien ne bloque le toucher ni le défilement.
   - On n'anime que transform, opacity, filter (flou borné) et stroke-dashoffset.
   - Mouvement réduit : simple fondu de 200 ms, sans décalage ni mouvement. */
export const EZ = "cubic-bezier(.16, 1, .3, 1)";

export const ANIM = {
  embleme: [{ opacity: 0, transform: "scale(.5)", filter: "blur(8px)" }, { opacity: 1, transform: "scale(1)", filter: "blur(0)" }],
  bloc: [{ opacity: 0, transform: "translateY(8px)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
  bouton: [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }],
  carte: [{ opacity: 0, transform: "translateY(16px) scale(.9)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
  lettre: [{ transform: "translateY(110%)" }, { transform: "translateY(0)" }],
};

export const DUREE = { embleme: 1200, bloc: 1200, bouton: 1000, carte: 1100, lettre: 1100 };

// Moment de départ de la dernière entrée (ouverture, onglet, fiche) : les blocs rendus un peu plus tard
// (données arrivées du réseau) se calent sur le même rythme au lieu d'arriver tous ensemble.
export const entreeRecente = () => performance.now() - rythme.debut < 2500;

export const restant = (t) => Math.max(0, rythme.debut + t - performance.now());

export function animer(el, type, t = 0) {
  if (!el?.animate) return;
  el.getAnimations().forEach((a) => a.cancel());
  if (calme) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "backwards" }); return; }
  el.animate(ANIM[type], { duration: DUREE[type], delay: restant(t), easing: EZ, fill: "backwards" });
}

// Les cartes une par une : 12 premières décalées de 180 ms, les suivantes ensemble
export function animerListe(els, t, ecart = 180, type = "carte") {
  [...els].forEach((el, i) => animer(el, type, t + Math.min(i, 12) * ecart));
}

// « Split text » : chaque lettre remonte de sous le masque de son mot (45 ms d'écart).
// Le titre garde son texte entier pour les lecteurs d'écran (aria-label), les lettres sont masquées.
export function decouper(el) {
  if (!el) return [];
  const texte = el.dataset.decoupe && el.querySelector(".mot") ? el.dataset.decoupe : el.textContent.trim();
  if (el.dataset.decoupe !== texte || !el.querySelector(".mot")) {
    const lettres = texte.split(/\s+/).map((m) =>
      `<span class="mot" aria-hidden="true">${[...m].map((c) => `<span class="lettre">${esc(c)}</span>`).join("")}</span>`).join(" ");
    // Titre (h1, h2) : aria-label. Simple texte (le nom dans l'en-tête) : copie invisible lue par VoiceOver.
    if (/^H\d$/.test(el.tagName)) { el.setAttribute("aria-label", texte); el.innerHTML = lettres; }
    else el.innerHTML = `<span class="sr-only">${esc(texte)}</span>${lettres}`;
    el.dataset.decoupe = texte;
  }
  return [...el.querySelectorAll(".lettre")];
}

export function ecrireTitre(el, texte) { // remplace un titre découpé par du texte simple
  if (el.dataset.decoupe === texte) return;
  el.textContent = texte; el.removeAttribute("aria-label"); delete el.dataset.decoupe;
}

export function animerTitre(el, t) {
  const lettres = decouper(el);
  if (calme) { animer(el, "bloc", t); return t; }
  lettres.forEach((l, i) => animer(l, "lettre", t + i * 45));
  return t + lettres.length * 45;
}

// La courbe de prix se dessine de gauche à droite
export function dessinerCourbe(svg, t) {
  const ligne = svg?.querySelector("polyline"); if (!ligne || calme) return;
  ligne.style.strokeDasharray = "1";
  ligne.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1400, delay: restant(t), easing: EZ, fill: "backwards" });
}

// Même courbe que EZ pour le compteur de la valeur (résolution de la courbe de Bézier)
export function bezier(x1, y1, x2, y2) {
  const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; f(x1, x2, m) < x ? (lo = m) : (hi = m); } return f(y1, y2, (lo + hi) / 2); };
}

export const courbeEZ = bezier(.16, 1, .3, 1);

// « Text roll » : le libellé est doublé d'une copie jaune qui prend sa place au survol / focus
export function preparerRoll(el) {
  if (!el || el.classList.contains("roll")) return;
  const noeud = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  if (!noeud) return;
  const texte = noeud.textContent.trim();
  const masque = document.createElement("span"); masque.className = "roll-masque";
  masque.innerHTML = `<span class="roll-a">${esc(texte)}</span><span class="roll-b" aria-hidden="true">${esc(texte)}</span>`;
  noeud.replaceWith(masque);
  el.classList.add("roll");
}

// Ouverture de l'appli (et rafraîchissement) : emblème, titre, couverture, filtres, puis les cartes
export const T_COUVERTURE = 1700, T_FILTRES = 2100, T_CARTES = 2400;

// Rendus à animer au prochain dessin (une seule fois : les re-rendus suivants, filtres, prix… restent immobiles)
export const aAnimer = new Set();

export const rythme = { debut: -1e9, tCouverture: T_COUVERTURE, tCartes: T_CARTES };

export function entreeApp() {
  rythme.debut = performance.now();
  rythme.tCouverture = T_COUVERTURE; rythme.tCartes = T_CARTES;
  aAnimer.add("valeur").add("collection");
  animer($(".marque img"), "embleme", 0);
  animerTitre($(".marque .marque-nom"), 500);
  animer($(".entete-droite"), "bloc", 900);
  if (PC.matches) animerListe([...document.querySelectorAll(".nav-bas > *")].sort((a, b) => getComputedStyle(a).order - getComputedStyle(b).order), 700, 80, "bloc");
  animer($(".choix-jeu"), "bloc", 1400);
  animer($(".couverture"), "bloc", T_COUVERTURE);
  animer($(".filtres"), "bouton", T_FILTRES);
}

export function entreeConnexion() {
  rythme.debut = performance.now();
  const c = $(".connexion-carte");
  animer(c.querySelector("img"), "embleme", 0);
  animerTitre(c.querySelector("h1"), 500);
  animer(c.querySelector("h1 + p"), "bloc", 1700);
  animer(c.querySelector(".connexion-corps"), "bouton", 2100);
}

// Changement d'onglet : même style, rythme resserré pour ne pas faire attendre
export const T_ONGLET = { couverture: 120, filtres: 240, cartes: 400 };

export function entreeVue(v) {
  rythme.debut = performance.now();
  const vue = $(`#vue-${v}`);
  aAnimer.add(v);
  if (v === "collection") {
    rythme.tCouverture = T_ONGLET.couverture; rythme.tCartes = T_ONGLET.cartes; aAnimer.add("valeur");
    animer(vue.querySelector(".choix-jeu"), "bloc", 0);
    animer(vue.querySelector(".couverture"), "bloc", T_ONGLET.couverture);
    animer(vue.querySelector(".filtres"), "bouton", T_ONGLET.filtres);
    return;
  }
  const racine = v === "classeur" ? vue.querySelector("#classeur-liste:not([hidden]), #classeur-set:not([hidden])") : vue;
  entreeBlocs(racine);
}

// Titre en split text, puis les autres blocs l'un après l'autre
export function entreeBlocs(racine) {
  if (!racine) return;
  let t = 0, i = 0;
  for (const el of racine.children) {
    if (el.hidden || el.matches(".sr-only, ul, .grille-classeur, .classeur, .familles")) continue;
    if (el.matches("h2")) { animerTitre(el, 0); continue; }
    animer(el, "bloc", t = 150 + i++ * 120);
  }
  return t;
}

// Les cartes d'une collection : titres d'extension et pochettes arrivent dans l'ordre de lecture
export function entreeCartes(racine, t) {
  let n = 0;
  racine.querySelectorAll(".titre-jeu, .page-titre, .tendance-ext, .sous-page h4, .pochette, .vide").forEach((el) => {
    const d = t + Math.min(n, 12) * 180;
    if (el.matches(".pochette")) { animer(el, "carte", d); n++; } else animer(el, "bloc", d);
  });
}

// Ouverture d'une fiche carte : visuel, nom en split text, puis les blocs ; la courbe se dessine
export function entreeFiche() {
  rythme.debut = performance.now();
  const f = $("#fiche-contenu");
  animer(f.querySelector(".fiche-visuel"), "carte", 0);
  animerTitre(f.querySelector(".fiche-tete h2"), 150);
  let t = 350;
  f.querySelectorAll(".fiche-ref, .fiche-tete .defaut, :scope > div:not([hidden]), :scope > section, :scope > dl, :scope > .alerte, :scope > p:not(.message), :scope > details")
    .forEach((el) => {
      if (!el.children.length && !el.textContent.trim()) return;
      animer(el, "bloc", t);
      if (el.querySelector(".graphe-zone")) dessinerCourbe(el.querySelector(".graphe-zone svg"), t + 200);
      t += 110;
    });
}

// « Text roll » sur les liens de la barre latérale (PC seulement : rien ne change sur iPhone)
export function rollBarreLaterale() { if (PC.matches) document.querySelectorAll(".nav-item").forEach(preparerRoll); }

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initAnimations() {
  document.querySelectorAll(".bouton-principal, .connexion-carte .bouton-envoi, .bouton-scanner").forEach(preparerRoll);
  rollBarreLaterale();
  PC.addEventListener?.("change", rollBarreLaterale);
}
