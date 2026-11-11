import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { BADGES, RARETES as RARETES_BADGES, FAMILLES, svgBadge } from "./badges.js?v=13";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s) => document.querySelector(s);
const euro = (v, dec = 2) => v == null ? "?" : Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (v) => v == null ? "" : `${v > 0 ? "+" : ""}${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NOM_JEU = { pokemon: "Pokémon", onepiece: "One Piece" };

/* ================= Animations d'entrée =================
   Référence validée : docs/animation-reference.html (inspiration vastworld.ai).
   - Tout est visible par défaut : chaque animation part de l'état caché avec fill:"backwards",
     donc si le JavaScript plante, rien ne reste caché. Rien ne bloque le toucher ni le défilement.
   - On n'anime que transform, opacity, filter (flou borné) et stroke-dashoffset.
   - Mouvement réduit : simple fondu de 200 ms, sans décalage ni mouvement. */
const EZ = "cubic-bezier(.16, 1, .3, 1)";
const ANIM = {
  embleme: [{ opacity: 0, transform: "scale(.5)", filter: "blur(8px)" }, { opacity: 1, transform: "scale(1)", filter: "blur(0)" }],
  bloc: [{ opacity: 0, transform: "translateY(8px)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
  bouton: [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }],
  carte: [{ opacity: 0, transform: "translateY(16px) scale(.9)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
  lettre: [{ transform: "translateY(110%)" }, { transform: "translateY(0)" }],
};
const DUREE = { embleme: 1200, bloc: 1200, bouton: 1000, carte: 1100, lettre: 1100 };

// Moment de départ de la dernière entrée (ouverture, onglet, fiche) : les blocs rendus un peu plus tard
// (données arrivées du réseau) se calent sur le même rythme au lieu d'arriver tous ensemble.
let debutEntree = -1e9;
const entreeRecente = () => performance.now() - debutEntree < 2500;
const restant = (t) => Math.max(0, debutEntree + t - performance.now());

function animer(el, type, t = 0) {
  if (!el?.animate) return;
  el.getAnimations().forEach((a) => a.cancel());
  if (calme) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "backwards" }); return; }
  el.animate(ANIM[type], { duration: DUREE[type], delay: restant(t), easing: EZ, fill: "backwards" });
}
// Les cartes une par une : 12 premières décalées de 180 ms, les suivantes ensemble
function animerListe(els, t, ecart = 180, type = "carte") {
  [...els].forEach((el, i) => animer(el, type, t + Math.min(i, 12) * ecart));
}

// « Split text » : chaque lettre remonte de sous le masque de son mot (45 ms d'écart).
// Le titre garde son texte entier pour les lecteurs d'écran (aria-label), les lettres sont masquées.
function decouper(el) {
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
function ecrireTitre(el, texte) { // remplace un titre découpé par du texte simple
  if (el.dataset.decoupe === texte) return;
  el.textContent = texte; el.removeAttribute("aria-label"); delete el.dataset.decoupe;
}
function animerTitre(el, t) {
  const lettres = decouper(el);
  if (calme) { animer(el, "bloc", t); return t; }
  lettres.forEach((l, i) => animer(l, "lettre", t + i * 45));
  return t + lettres.length * 45;
}

// La courbe de prix se dessine de gauche à droite
function dessinerCourbe(svg, t) {
  const ligne = svg?.querySelector("polyline"); if (!ligne || calme) return;
  ligne.style.strokeDasharray = "1";
  ligne.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1400, delay: restant(t), easing: EZ, fill: "backwards" });
}

// Même courbe que EZ pour le compteur de la valeur (résolution de la courbe de Bézier)
function bezier(x1, y1, x2, y2) {
  const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; f(x1, x2, m) < x ? (lo = m) : (hi = m); } return f(y1, y2, (lo + hi) / 2); };
}
const courbeEZ = bezier(.16, 1, .3, 1);

// « Text roll » : le libellé est doublé d'une copie jaune qui prend sa place au survol / focus
function preparerRoll(el) {
  if (!el || el.classList.contains("roll")) return;
  const noeud = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  if (!noeud) return;
  const texte = noeud.textContent.trim();
  const masque = document.createElement("span"); masque.className = "roll-masque";
  masque.innerHTML = `<span class="roll-a">${esc(texte)}</span><span class="roll-b" aria-hidden="true">${esc(texte)}</span>`;
  noeud.replaceWith(masque);
  el.classList.add("roll");
}
document.querySelectorAll(".bouton-principal, .connexion-carte button, .bouton-scanner").forEach(preparerRoll);

// Ouverture de l'appli (et rafraîchissement) : emblème, titre, couverture, filtres, puis les cartes
const T_COUVERTURE = 1700, T_FILTRES = 2100, T_CARTES = 2400;
// Rendus à animer au prochain dessin (une seule fois : les re-rendus suivants, filtres, prix… restent immobiles)
const aAnimer = new Set();
let tCouverture = T_COUVERTURE, tCartes = T_CARTES;
function entreeApp() {
  debutEntree = performance.now();
  tCouverture = T_COUVERTURE; tCartes = T_CARTES;
  aAnimer.add("valeur").add("collection");
  animer($(".marque img"), "embleme", 0);
  animerTitre($(".marque .marque-nom"), 500);
  animer($(".entete-droite"), "bloc", 900);
  if (PC.matches) animerListe([...document.querySelectorAll(".nav-bas > *")].sort((a, b) => getComputedStyle(a).order - getComputedStyle(b).order), 700, 80, "bloc");
  animer($(".choix-jeu"), "bloc", 1400);
  animer($(".couverture"), "bloc", T_COUVERTURE);
  animer($(".filtres"), "bouton", T_FILTRES);
}
function entreeConnexion() {
  debutEntree = performance.now();
  const c = $(".connexion-carte");
  animer(c.querySelector("img"), "embleme", 0);
  animerTitre(c.querySelector("h1"), 500);
  animer(c.querySelector("h1 + p"), "bloc", 1700);
  animer(c.querySelector("form"), "bouton", 2100);
}
// Changement d'onglet : même style, rythme resserré pour ne pas faire attendre
const T_ONGLET = { couverture: 120, filtres: 240, cartes: 400 };
function entreeVue(v) {
  debutEntree = performance.now();
  const vue = $(`#vue-${v}`);
  aAnimer.add(v);
  if (v === "collection") {
    tCouverture = T_ONGLET.couverture; tCartes = T_ONGLET.cartes; aAnimer.add("valeur");
    animer(vue.querySelector(".choix-jeu"), "bloc", 0);
    animer(vue.querySelector(".couverture"), "bloc", T_ONGLET.couverture);
    animer(vue.querySelector(".filtres"), "bouton", T_ONGLET.filtres);
    return;
  }
  const racine = v === "classeur" ? vue.querySelector("#classeur-liste:not([hidden]), #classeur-set:not([hidden])") : vue;
  entreeBlocs(racine);
}
// Titre en split text, puis les autres blocs l'un après l'autre
function entreeBlocs(racine) {
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
function entreeCartes(racine, t) {
  let n = 0;
  racine.querySelectorAll(".titre-jeu, .page-titre, .tendance-ext, .sous-page h4, .pochette, .vide").forEach((el) => {
    const d = t + Math.min(n, 12) * 180;
    if (el.matches(".pochette")) { animer(el, "carte", d); n++; } else animer(el, "bloc", d);
  });
}
// Ouverture d'une fiche carte : visuel, nom en split text, puis les blocs ; la courbe se dessine
function entreeFiche() {
  debutEntree = performance.now();
  const f = $("#fiche-contenu");
  animer(f.querySelector(".fiche-haut .visuel"), "carte", 0);
  animerTitre(f.querySelector(".fiche-haut h2"), 150);
  let t = 350;
  f.querySelectorAll(".fiche-haut .infos, .fiche-haut .defaut, :scope > dl, :scope > .alerte, :scope > .historique, :scope > p:not(.message), :scope > details")
    .forEach((el) => { animer(el, "bloc", t); if (el.matches(".historique")) dessinerCourbe(el.querySelector("svg"), t + 200); t += 120; });
}

const etat = {
  moi: null, toutes: [], jeu: "pokemon", categorie: "", recherche: "", tri: "extension",
  vitrine: [], membreChoisi: null, extensions: [], sets: null,
};

/* ================= Connexion ================= */
$("#form-connexion").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim(), pseudo = $("#pseudo").value.trim(), msg = $("#connexion-message");
  msg.textContent = "Envoi du lien…";
  const { error } = await sb.auth.signInWithOtp({
    email, options: { emailRedirectTo: location.origin + location.pathname, data: pseudo ? { pseudo } : undefined },
  });
  msg.textContent = error ? `Le lien n'a pas pu être envoyé : ${error.message}` : `Lien envoyé à ${email}. Ouvre-le sur cet appareil pour te connecter.`;
});
$("#deconnexion").addEventListener("click", () => sb.auth.signOut());

sb.auth.onAuthStateChange((_e, session) => afficher(session));
sb.auth.getSession().then(({ data }) => afficher(data.session));

let charge = false;
async function afficher(session) {
  const connexionCachee = $("#ecran-connexion").hidden;
  $("#ecran-connexion").hidden = !!session;
  $("#app").hidden = !session;
  if (!session) { if (connexionCachee) entreeConnexion(); charge = false; return; }
  if (charge) return;
  charge = true;
  entreeApp();
  const { data: moi } = await sb.from("membres").select("id, pseudo, cree_le").eq("auth_id", session.user.id).maybeSingle();
  etat.moi = moi;
  $("#mon-pseudo").textContent = moi?.pseudo ?? "toi";
  $("#profil-nom").textContent = moi?.pseudo ?? "";
  $("#initiale").textContent = (moi?.pseudo ?? "?").trim().charAt(0).toUpperCase() || "?";
  await Promise.all([chargerCollection(), chargerJournal()]);
  verifierBadges();
}

/* ================= Données ================= */
async function chargerCollection() {
  const { data, error } = await sb.from("ma_collection").select("*");
  if (error) { $("#classeur").innerHTML = `<p class="vide">La collection n'a pas pu être chargée : ${esc(error.message)}</p>`; return; }
  etat.lignes = data ?? [];
  etat.toutes = fusionner(data ?? []);
  await chargerTendances(etat.toutes);
  dessinerCollection();
  verifierBadges();
}

/* Tendance sur 30 jours : moyenne Cardmarket des 7 derniers jours comparée à celle des 30 derniers jours
   (les deux sur la même base, toutes langues). Notre propre historique FR prendra le relais quand il aura 30 jours. */
async function chargerTendances(liste) {
  const ids = [...new Set(liste.map((x) => x.produit_id))];
  if (!ids.length) return;
  const { data } = await sb.from("prix_actuel").select("produit_id, etat_prix, source, detail").in("produit_id", ids).eq("source", "api_fr");
  const m = new Map((data ?? []).map((r) => [`${r.produit_id}|${r.etat_prix}`, r.detail]));
  for (const x of liste) {
    const d = m.get(`${x.produit_id}|${x.defaut ? "defaut" : "standard"}`);
    const m7 = Number(d?.moy7), m30 = Number(d?.moy30);
    x.tendance = m7 > 0 && m30 > 0 ? (m7 / m30 - 1) * 100 : null;
  }
}
function tendanceMoyenne(liste) {
  let s = 0, poids = 0;
  for (const x of liste) if (x.tendance != null && x.valeur > 0) { s += x.tendance * x.valeur; poids += x.valeur; }
  return poids ? s / poids : null;
}
function etiquetteTendance(t, court = false) {
  if (t == null) return "";
  const r = Math.round(t);
  if (Math.abs(r) < 2) return `<span class="tendance stable">${court ? "= 30 j" : "stable sur 30 j"}</span>`;
  return `<span class="tendance ${r > 0 ? "hausse" : "baisse"}">${r > 0 ? "↗ +" : "↘ "}${r} %${court ? " 30 j" : " sur 30 j"}</span>`;
}

// Un même produit acheté à des prix différents (ex. 3 ETB 30 Ans) = une seule pochette
function fusionner(lignes) {
  const m = new Map();
  for (const x of lignes) {
    const k = `${x.produit_id}|${x.defaut}`;
    const y = m.get(k);
    if (!y) { m.set(k, { ...x, valeur: x.valeur == null ? null : Number(x.valeur), cout: x.cout == null ? null : Number(x.cout) }); continue; }
    y.quantite += x.quantite;
    if (x.valeur != null) y.valeur = (y.valeur ?? 0) + Number(x.valeur);
    if (x.cout != null) y.cout = (y.cout ?? 0) + Number(x.cout);
  }
  for (const y of m.values()) {
    y.prix_achat = y.cout != null ? y.cout / y.quantite : null;
    y.benefice = y.cout != null && y.valeur != null ? y.valeur - y.cout : null;
    y.evolution_pct = y.cout && y.valeur != null ? (y.valeur / y.cout - 1) * 100 : null;
  }
  return [...m.values()];
}

const duJeu = () => etat.toutes.filter((x) => x.jeu === etat.jeu);

function dessinerCollection() {
  $("#titre-collection").textContent = `Collection ${NOM_JEU[etat.jeu]}`;
  resume();
  dessinerClasseur();
}

function resume() {
  const c = duJeu();
  const somme = (l, f) => l.reduce((s, x) => s + Number(f(x) ?? 0), 0);
  const scelle = c.filter((x) => x.categorie === "scelle"), cartes = c.filter((x) => x.categorie === "carte");
  const valeur = somme(c, (x) => x.valeur);
  const achat = somme(c, (x) => x.cout);
  const gain = somme(c.filter((x) => x.cout != null && x.valeur != null), (x) => x.valeur - x.cout);
  const nb = (l) => somme(l, (x) => x.quantite);
  compteur($("#total-valeur"), valeur);
  $("#total-scelle").innerHTML = `${euro(somme(scelle, (x) => x.valeur), 0)} <small>(${nb(scelle)})</small>`;
  $("#total-cartes").innerHTML = `${euro(somme(cartes, (x) => x.valeur), 0)} <small>(${nb(cartes)})</small>`;
  $("#total-achat").textContent = euro(achat, 0);
  const g = $("#total-gain");
  g.innerHTML = `<span class="pastille">${pct(achat ? (gain / achat) * 100 : 0)}</span> ${gain >= 0 ? "+" : ""}${euro(gain, 0)} de plus-value`;
  g.className = gain >= 0 ? "positif" : "negatif";
  requestAnimationFrame(() => { $("#jauge-achat").style.width = `${valeur ? Math.min(100, (achat / valeur) * 100) : 0}%`; });
  const dates = c.map((x) => x.prix_date).filter(Boolean).sort();
  const enAttente = c.filter((x) => x.prix_actuel == null).length;
  $("#maj-prix").textContent = (dates.length ? `Dernier relevé de prix le ${new Date(dates.at(-1)).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.` : "")
    + (enAttente ? ` ${enAttente} objet${enAttente > 1 ? "s" : ""} en attente de prix.` : "");
  const tg = tendanceMoyenne(c);
  $("#tendance-globale").innerHTML = tg == null ? "" : `Marché sur 30 jours : ${etiquetteTendance(tg)}`;
}

// La valeur compte de 0 à sa valeur à l'entrée (au moment où la couverture arrive),
// puis d'une valeur à l'autre lors des mises à jour. Mouvement réduit : affichée directement.
let tourCompteur = 0;
function compteur(el, cible) {
  const entree = aAnimer.delete("valeur");
  const depart = entree ? 0 : (el._valeur ?? 0);
  el._valeur = cible;
  const tour = ++tourCompteur;
  if (calme || depart === cible) { el.textContent = euro(cible, 0); return; }
  el.textContent = euro(depart, 0);
  const t0 = performance.now() + (entree ? restant(tCouverture) : 0), duree = 1200;
  const pas = (t) => {
    if (tour !== tourCompteur) return;
    const k = Math.min(1, Math.max(0, (t - t0) / duree));
    el.textContent = euro(depart + (cible - depart) * courbeEZ(k), 0);
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

/* ================= Classeur ================= */
function filtrer(liste) {
  const q = etat.recherche.toLowerCase();
  return liste.filter((x) => (!etat.categorie || x.categorie === etat.categorie) &&
    (!q || `${x.nom} ${x.numero ?? ""} ${x.extension ?? ""} ${x.rarete ?? ""} ${x.type_scelle ?? ""}`.toLowerCase().includes(q)));
}

function pochette(x, avecAchat = true) {
  const img = x.image_url
    ? `<img src="${esc(x.image_url)}" alt="" loading="lazy">`
    : `<span class="sans-image">${esc(x.categorie === "scelle" ? (x.type_scelle ?? "Scellé") : (x.rarete ?? "Carte"))}</span>`;
  const infos = x.categorie === "carte"
    ? [x.numero, x.rarete, x.langue !== "FR" ? x.langue : null].filter(Boolean).map(esc).join(" ")
    : [esc(x.variante), x.defaut ? `<span class="defaut">défaut</span>` : null].filter(Boolean).join(" ");
  const evo = avecAchat && x.evolution_pct != null
    ? `<span class="evo ${x.evolution_pct >= 0 ? "positif" : "negatif"}">${pct(x.evolution_pct)}</span>` : "";
  const prix = x.prix_actuel == null ? `<strong class="inconnu" title="Prix attendu au prochain relevé">?</strong>` : `<strong>${euro(x.prix_actuel)}</strong>`;
  return `<button class="pochette ${x.categorie}" data-id="${x.produit_id}" data-defaut="${x.defaut}">
    ${x.quantite > 1 ? `<span class="quantite">×${x.quantite}</span>` : ""}
    <span class="visuel">${img}</span>
    <span class="nom">${esc(x.nom)}</span>
    <span class="infos">${infos}</span>
    <span class="prix">${prix}${evo}</span>
    ${etiquetteTendance(x.tendance, true)}
  </button>`;
}

const parPrix = (a, b) => Number(b.prix_actuel ?? -1) - Number(a.prix_actuel ?? -1);
function sousSections(items, avecAchat) {
  const sc = items.filter((x) => x.categorie === "scelle").sort(parPrix);
  const ca = items.filter((x) => x.categorie === "carte").sort(parPrix);
  const bloc = (titre, l) => l.length ? `<div class="sous-page"><h4>${titre} <span>${l.reduce((s, x) => s + x.quantite, 0)}</span></h4>
    <div class="pochettes">${l.map((x) => pochette(x, avecAchat)).join("")}</div></div>` : "";
  return bloc("Scellé", sc) + bloc("Cartes", ca);
}

function grouper(liste, avecAchat) {
  if (etat.tri !== "extension") {
    const cle = etat.tri === "gain" ? (x) => Number(x.benefice ?? -1e9)
      : etat.tri === "tendance" ? (x) => Number(x.tendance ?? -1e9) : (x) => Number(x.valeur ?? 0);
    return `<div class="page"><div class="pochettes">${[...liste].sort((a, b) => cle(b) - cle(a)).map((x) => pochette(x, avecAchat)).join("")}</div></div>`;
  }
  const pages = new Map();
  for (const x of liste) {
    const k = `${x.jeu}|${x.ordre ?? "Z"}|${x.extension ?? "Divers"}`;
    if (!pages.has(k)) pages.set(k, []);
    pages.get(k).push(x);
  }
  const cles = [...pages.keys()].sort((a, b) => {
    const [ja, oa] = a.split("|"), [jb, ob] = b.split("|");
    return jb.localeCompare(ja) || ob.localeCompare(oa, "fr", { numeric: true });
  });
  return cles.map((k) => {
    const items = pages.get(k), x0 = items[0];
    const somme = items.reduce((s, x) => s + Number(x.valeur ?? 0), 0);
    return `<section class="page">
      <div class="page-titre"><h3>${esc(x0.extension ?? "Divers")}</h3><span class="code">${esc(x0.extension_code ?? "")}</span><span class="somme">${euro(somme, 0)}</span></div>
      ${etiquetteTendance(tendanceMoyenne(items)) ? `<p class="tendance-ext">Tendance du marché : ${etiquetteTendance(tendanceMoyenne(items))}</p>` : ""}
      ${sousSections(items, avecAchat)}
    </section>`;
  }).join("");
}

function dessinerClasseur() {
  const liste = filtrer(duJeu());
  $("#classeur").innerHTML = liste.length ? grouper(liste, true)
    : duJeu().length ? `<p class="vide">Rien ne correspond à ces filtres. Essaie « Scellé et cartes » ou une autre recherche.</p>`
    : `<p class="vide">Ta collection ${NOM_JEU[etat.jeu]} est vide. Appuie sur « + Ajouter » pour commencer.</p>`;
  if (aAnimer.delete("collection")) entreeCartes($("#classeur"), tCartes);
}

document.querySelectorAll(".filtres .puces").forEach((g) => g.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  etat[g.dataset.filtre] = b.dataset.val;
  dessinerClasseur();
}));
$("#recherche").addEventListener("input", (e) => { etat.recherche = e.target.value; dessinerClasseur(); });
$("#tri").addEventListener("change", (e) => { etat.tri = e.target.value; dessinerClasseur(); });

/* ================= Navigation : barre du bas et choix du jeu ================= */
function montrerVue(v) {
  document.querySelectorAll(".nav-item").forEach((x) => x.toggleAttribute("aria-current", x.dataset.vue === v));
  document.querySelector(`.nav-item[data-vue="${v}"]`)?.setAttribute("aria-current", "page");
  $("#vue-collection").hidden = v !== "collection";
  $("#vue-equipage").hidden = v !== "equipage";
  $("#vue-classeur").hidden = v !== "classeur";
  $("#vue-badges").hidden = v !== "badges";
  if (v !== "badges") etat.vueAvant = v;
  scrollTo({ top: 0 });
  entreeVue(v);
  if (v === "equipage") chargerEquipage();
  else if (v === "classeur") chargerClasseur().then(() => (etat.setOuvert ? ouvrirSet(etat.setOuvert, true) : dessinerClasseurListe()));
  else if (v === "badges") dessinerMesBadges();
  else dessinerCollection();
}
document.querySelectorAll(".nav-item").forEach((o) => o.addEventListener("click", () => montrerVue(o.dataset.vue)));
function marquerJeu(jeu) {
  document.querySelectorAll(".jeu-choix").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.jeu === jeu)));
}
document.querySelectorAll(".jeu-choix").forEach((o) => o.addEventListener("click", () => {
  etat.jeu = o.dataset.jeu; marquerJeu(etat.jeu);
  debutEntree = performance.now(); tCouverture = 0; tCartes = 150; aAnimer.add("valeur").add("collection");
  dessinerCollection();
}));

async function chargerEquipage() {
  const [{ data, error }, badgesMembres] = await Promise.all([sb.from("vitrine").select("*"), badgesDesMembres()]);
  if (error) { $("#membres").innerHTML = `<li class="vide">L'Équipage n'a pas pu être chargé : ${esc(error.message)}</li>`; return; }
  etat.vitrine = data ?? [];
  const parMembre = new Map();
  for (const x of etat.vitrine) {
    const m = parMembre.get(x.pseudo) ?? { valeur: 0, objets: 0 };
    m.valeur += Number(x.valeur ?? 0); m.objets += x.quantite;
    parMembre.set(x.pseudo, m);
  }
  $("#membres").innerHTML = [...parMembre.entries()].sort((a, b) => b[1].valeur - a[1].valeur).map(([p, m]) => `<li><button data-pseudo="${esc(p)}" aria-pressed="${p === etat.membreChoisi}">
      <span><span class="pseudo">${esc(p)}</span><br><span class="infos">${m.objets} objets</span>${resumeBadges(badgesMembres.get(p))}</span>
      <span class="valeur">${euro(m.valeur, 0)}</span></button></li>`).join("")
    || `<li class="vide">Personne n'a encore de collection. Partage le lien du site à L'Équipage.</li>`;
  if (aAnimer.delete("equipage")) animerListe($("#membres").children, 400, 120, "bloc");
  dessinerVitrine();
}
$("#membres").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  etat.membreChoisi = etat.membreChoisi === b.dataset.pseudo ? null : b.dataset.pseudo;
  document.querySelectorAll("#membres button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.pseudo === etat.membreChoisi)));
  dessinerVitrine();
  debutEntree = performance.now(); entreeCartes($("#vitrine"), 0);
});
function dessinerVitrine() {
  const liste = etat.vitrine.filter((x) => x.pseudo === etat.membreChoisi);
  $("#vitrine").innerHTML = !etat.membreChoisi ? "" : ["pokemon", "onepiece"].map((j) => {
    const l = liste.filter((x) => x.jeu === j);
    return l.length ? `<h3 class="titre-jeu">Collection ${NOM_JEU[j]}</h3>${grouper(l, false)}` : "";
  }).join("");
}

/* ================= Fiche ================= */
document.addEventListener("click", async (e) => {
  const p = e.target.closest(".pochette"); if (!p) return;
  const id = Number(p.dataset.id), defaut = p.dataset.defaut === "true";
  const mien = !!p.closest("#classeur");
  const x = (mien ? etat.toutes : etat.vitrine).find((y) => y.produit_id === id && y.defaut === defaut);
  if (x) ouvrirFiche(x, mien);
});

async function ouvrirFiche(x, mien) {
  const { data: hist } = await sb.from("prix").select("le, prix, source, valide")
    .eq("produit_id", x.produit_id).eq("etat_prix", x.defaut ? "defaut" : "standard").order("le");
  const valides = (hist ?? []).filter((h) => h.valide);
  const suspect = (hist ?? []).filter((h) => !h.valide).at(-1);
  const sources = { airtable: "relevé Airtable", api_fr: "Cardmarket FR (automatique)", manuel: "saisie manuelle" };
  $("#fiche-contenu").innerHTML = `
    <div class="fiche-haut">
      <span class="visuel">${x.image_url ? `<img src="${esc(x.image_url)}" alt="">` : `<span class="sans-image">${esc(x.type_scelle ?? x.rarete ?? "")}</span>`}</span>
      <div>
        <h2>${esc(x.nom)}</h2>
        <p class="infos">${esc(x.extension ?? "")} ${esc(x.numero ?? "")}</p>
        ${x.defaut ? `<p class="defaut">Exemplaire avec défaut</p>` : ""}
      </div>
    </div>
    <dl>
      <dt>Prix actuel</dt><dd>${x.prix_actuel == null ? "? <span class='infos'>attendu au prochain relevé</span>" : euro(x.prix_actuel)}</dd>
      <dt>Quantité</dt><dd>${mien ? `<span class="stepper"><button data-delta="-1" aria-label="Retirer un exemplaire">−</button><span id="fiche-qte">${x.quantite}</span><button data-delta="1" aria-label="Ajouter un exemplaire">+</button></span>` : x.quantite}</dd>
      <dt>Valeur</dt><dd>${euro(x.valeur)}</dd>
      ${x.tendance != null ? `<dt>Marché 30 jours</dt><dd>${etiquetteTendance(x.tendance)}</dd>` : ""}
      ${mien && x.prix_achat != null ? `<dt>Payé</dt><dd>${euro(x.prix_achat)} l'unité${x.quantite > 1 ? " en moyenne" : ""}</dd><dt>Plus-value</dt><dd class="${(x.benefice ?? 0) >= 0 ? "evo positif" : "evo negatif"}">${euro(x.benefice)} (${pct(x.evolution_pct)})</dd>` : ""}
      ${mien && x.prix_achat == null && x.categorie === "carte" ? `<dt>Origine</dt><dd>Tirée d'un booster 🎁</dd>` : ""}
      <dt>Source</dt><dd>${esc(sources[x.prix_source] ?? x.prix_source ?? "—")}${x.prix_date ? `, le ${new Date(x.prix_date).toLocaleDateString("fr-FR")}` : ""}</dd>
    </dl>
    ${suspect ? `<p class="alerte">Prix en attente de confirmation : ${euro(suspect.prix)} le ${new Date(suspect.le).toLocaleDateString("fr-FR")}. Il sera pris en compte s'il se confirme au prochain relevé.</p>` : ""}
    ${courbe(valides)}
    ${x.lien_cardmarket ? `<p><a href="${esc(x.lien_cardmarket)}" target="_blank" rel="noopener">Voir les offres FR sur Cardmarket</a></p>` : ""}
    ${mien ? `<details class="prix-manuel"><summary>Saisir un prix moi-même</summary>
      <div class="ligne-recherche"><input id="prix-manuel" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Prix unitaire en €"><button id="valider-prix" type="button">Enregistrer</button></div>
      <p class="aide">Utile pour les produits que le relevé automatique ne suit pas (boosters à l'unité, coffrets, One Piece).</p></details>` : ""}
    <p id="fiche-message" class="message" role="status"></p>`;
  ouvrirFenetreFiche();
  entreeFiche();

  if (!mien) return;
  $("#fiche-contenu").querySelectorAll("[data-delta]").forEach((b) => b.addEventListener("click", async () => {
    const delta = Number(b.dataset.delta);
    if (delta < 0 && x.quantite === 1 && !confirm(`Retirer « ${x.nom} » de ta collection ?`)) return;
    const { data: reste, error } = await sb.rpc("modifier_quantite", { p_produit_id: x.produit_id, p_defaut: x.defaut, p_delta: delta });
    if (error) { $("#fiche-message").textContent = `Modification impossible : ${error.message}`; return; }
    x.quantite = reste;
    $("#fiche-qte").textContent = reste;
    await chargerCollection();
    if (reste === 0) $("#fiche").close();
  }));
  $("#valider-prix")?.addEventListener("click", async () => {
    const v = Number($("#prix-manuel").value);
    if (!(v >= 0) || $("#prix-manuel").value === "") { $("#fiche-message").textContent = "Indique un prix en euros, par exemple 12,50."; return; }
    const { error } = await sb.rpc("saisir_prix", { p_produit_id: x.produit_id, p_prix: v, p_defaut: x.defaut });
    $("#fiche-message").textContent = error ? `Prix non enregistré : ${error.message}` : `Prix enregistré : ${euro(v)}.`;
    if (!error) chargerCollection();
  });
}

function courbe(points) {
  if (points.length < 2) return `<div class="historique"><p>L'historique des prix se construit à chaque relevé.</p></div>`;
  const v = points.map((p) => Number(p.prix)), min = Math.min(...v), max = Math.max(...v), w = 300, h = 60;
  const xy = v.map((y, i) => `${(i / (v.length - 1)) * w},${max === min ? h / 2 : h - ((y - min) / (max - min)) * h}`).join(" ");
  return `<div class="historique">
    <svg viewBox="-4 -4 ${w + 8} ${h + 8}" preserveAspectRatio="none" role="img" aria-label="Évolution du prix de ${euro(v[0])} à ${euro(v.at(-1))}">
      <polyline points="${xy}" pathLength="1" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    </svg>
    <p>${points.length} relevés, de ${euro(min)} à ${euro(max)}</p></div>`;
}

/* ================= Catalogue (TCGdex / OPTCG via notre relais) ================= */
async function catalogue(url) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/catalogue?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_KEY },
  });
  if (!r.ok) throw new Error(`catalogue indisponible (${r.status})`);
  return r.json();
}
const TCG = "https://api.tcgdex.net/v2";
async function setsPokemon() {
  if (!etat.sets) {
    const l = await catalogue(`${TCG}/fr/sets`);
    etat.sets = new Map(l.map((s) => [s.id, s]));
  }
  return etat.sets;
}
const RARETES = { "illustration rare": "AR", "illustration spéciale rare": "SAR", "hyper rare": "Gold", "ultra rare": "FA", "promo": "Promo" };

/* ================= Index local des cartes Pokémon FR =================
   Toutes les cartes (≈ 20 000) téléchargées une fois (≈ 200 Ko compressés), puis cherchées sur le téléphone :
   sans accents, plusieurs mots-clés, numéro seul (« 191 » = toutes les cartes 191/x et x/191), « nom + numéro »… */
let indexCartes = null;
const cleNum = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, "").replace(/^([A-Z]*)0*(\d+)$/, "$1$2");
function chargerIndex() {
  if (!indexCartes) {
    indexCartes = (async () => {
      const { data } = await sb.auth.getSession();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/catalogue?index=fr`, {
        headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_KEY },
      });
      if (!r.ok) throw new Error(`index indisponible (${r.status})`);
      const j = await r.json();
      const sets = new Map(j.sets.map(([id, nom, total, ordre]) => [id, { id, nom, total, ordre }]));
      const cartes = j.cartes.map(([id, localId, name, img]) => {
        const set = sets.get(id.slice(0, id.lastIndexOf("-")));
        return { id, localId, name, set, image: img ? (img.startsWith("http") ? img : j.img + img) : null,
          n: cleNum(localId), cle: ` ${sansAccent(`${name} ${set?.nom ?? ""}`)} ` };
      });
      return { sets, cartes };
    })().catch((e) => { indexCartes = null; throw e; });
  }
  return indexCartes;
}

function rechercheLocale(idx, q) {
  const brut = String(q ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nums = [], mots = [];
  for (const t of brut.split(/[\s,;]+/).filter(Boolean)) {
    const m = t.match(/^([a-z]{0,4}\d+)\/([a-z]{0,4}\d+)$/);
    if (m) nums.push({ a: cleNum(m[1]), b: cleNum(m[2]) });
    else if (/^([a-z]{1,4})?\d+$/.test(t)) nums.push({ a: cleNum(t) });
    else mots.push(...sansAccent(t).split(" ").filter(Boolean));
  }
  if (!nums.length && !mots.length) return [];
  const res = [];
  for (const c of idx.cartes) {
    if (mots.some((w) => !c.cle.includes(w))) continue;
    const tot = c.set?.total != null ? String(c.set.total) : null;
    let score = 0, ok = true;
    for (const { a, b } of nums) {
      if (b != null) { if (c.n === a && (tot === b || /^[A-Z]/.test(a))) score += 4; else { ok = false; break; } }
      else if (c.n === a) score += 2;   // le numéro de la carte
      else if (tot === a) score += 1;   // le total de l'extension
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (mots.length) {
      const nom = sansAccent(c.name);
      if (nom === mots.join(" ")) score += 2;
      else if (c.cle.includes(` ${mots[0]}`)) score += 1; // mot en début de mot
    }
    res.push({ c, score });
  }
  res.sort((x, y) => y.score - x.score || (y.c.set?.ordre ?? -1) - (x.c.set?.ordre ?? -1) || (parseInt(y.c.localId) || 0) - (parseInt(x.c.localId) || 0));
  return res.map((x) => x.c);
}

/* ================= Prix déjà connus (pour l'affichage au scan) ================= */
// Prix de la collection d'abord, sinon prix relevé la nuit pour toute l'extension (table prix_catalogue)
async function prixConnus(ids) {
  const out = new Map();
  if (!ids.length) return out;
  const { data, error } = await sb.rpc("prix_scan", { p_ids: ids });
  if (error) throw error;
  for (const x of data ?? []) out.set(x.tcgdex_id, x);
  return out;
}

/* ================= Ajout ================= */
const ajout = { type: "carte", choix: null };

$("#bouton-ajouter").addEventListener("click", async () => {
  ajout.choix = null; ajout.scanIA = null; ajout.opChoisi = null;
  arreterWebcam();
  $("#ajout-titre").textContent = `Ajouter à la collection ${NOM_JEU[etat.jeu]}`;
  $("#ajout-message").textContent = "";
  $("#carte-resultats").innerHTML = ""; $("#carte-statut").textContent = "";
  $("#op-resultats").innerHTML = ""; $("#op-statut").textContent = ""; $("#scan-statut").textContent = "";
  $("#aj-quantite").value = 1; $("#aj-prix").value = "";
  choisirType("carte");
  $("#ajout").showModal();
  chargerIndex().catch(() => {}); // en arrière-plan : prêt avant la première recherche
  await remplirExtensions();
});

$("#ajout-type").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) choisirType(b.dataset.val); });
function choisirType(t) {
  ajout.type = t; ajout.choix = null;
  $("#ajout-type").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === t)));
  const carte = t === "carte", poke = etat.jeu === "pokemon";
  $("#ajout-carte-pokemon").hidden = !(carte && poke);
  $("#ajout-carte-onepiece").hidden = !(carte && !poke);
  $("#ajout-scelle").hidden = carte;
  $("#bloc-etat").hidden = !carte;
  $("#ajout-final").hidden = carte && poke; // la carte Pokémon s'affiche une fois choisie
  $("#ajout-choix").innerHTML = "";
  $("#bloc-destination").hidden = true;
  ajout.destManuelle = false;
  marquerDestination("collection", "");
}

async function remplirExtensions() {
  const { data } = await sb.from("extensions").select("id, jeu, code, nom_fr, nom_en, ordre").order("ordre", { ascending: false });
  etat.extensions = data ?? [];
  $("#sc-extension").innerHTML = etat.extensions.filter((e) => e.jeu === etat.jeu)
    .map((e) => `<option value="${e.id}">${esc(e.nom_fr)} (${esc(e.code)})</option>`).join("");
  nomScelle();
}
function nomScelle() {
  const e = etat.extensions.find((x) => String(x.id) === $("#sc-extension").value);
  const type = $("#sc-type").value, v = $("#sc-variante").value.trim();
  $("#sc-nom").value = `${type} ${e?.code ?? ""}${v ? " " + v : ""}`.trim();
}
["#sc-extension", "#sc-type", "#sc-variante"].forEach((s) => $(s).addEventListener("input", nomScelle));

// --- Recherche de cartes Pokémon ---
$("#bouton-chercher").addEventListener("click", () => chercherCartes($("#recherche-carte").value));
$("#recherche-carte").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); chercherCartes(e.target.value); } });

async function chercherCartes(saisie) {
  const q = saisie.trim(); if (!q) return;
  const statut = $("#carte-statut");
  statut.textContent = "Recherche…";
  try {
    let res;
    try { res = rechercheLocale(await chargerIndex(), q); }
    catch { // index indisponible : recherche en ligne, plus limitée
      const m = q.match(/^(TG|GG)?\s*0*(\d{1,3})\s*(?:\/\s*(?:TG|GG)?\s*(\d{1,3}))?$/i);
      if (m) res = await parNumero(m[1] ? `${m[1].toUpperCase()}${m[2].padStart(2, "0")}` : m[2], m[3] ? Number(m[3]) : null);
      else res = await catalogue(`${TCG}/fr/cards?name=${encodeURIComponent(q)}`);
    }
    await afficherResultats(res.slice(0, 120));
    statut.textContent = res.length
      ? `${res.length} carte${res.length > 1 ? "s" : ""} trouvée${res.length > 1 ? "s" : ""}${res.length > 120 ? " (les 120 premières affichées : ajoute un mot pour affiner)" : ""}. Touche la tienne.`
      : "Aucune carte trouvée. Essaie un autre mot, ou le numéro (ex. 221, 221/191).";
  } catch (err) { statut.textContent = `Recherche impossible : ${err.message}`; }
}

async function parNumero(num, total) {
  const essais = [...new Set([num, num.padStart(3, "0"), String(Number(num) || num)])];
  const vus = new Map();
  for (const n of essais) for (const c of await catalogue(`${TCG}/fr/cards?localId=${encodeURIComponent(n)}`)) vus.set(c.id, c);
  let l = [...vus.values()];
  if (total) {
    const sets = await setsPokemon();
    const bons = l.filter((c) => sets.get(c.id.slice(0, c.id.lastIndexOf("-")))?.cardCount?.official === total);
    if (bons.length) l = bons;
  }
  return l.reverse(); // les extensions récentes d'abord
}

// Les cartes toutes récentes (ex. Règne Delta) et les promos n'ont pas encore d'image dans TCGdex :
// on les affiche quand même, avec une vignette provisoire. L'image arrive plus tard (relevé de la nuit).
function vignetteProvisoire(nom, numero, ext) {
  return `<span class="vignette-provisoire"><strong>${esc(nom)}</strong><span>${esc(numero)}</span><span>${esc(ext ?? "")}</span></span>`;
}
async function afficherResultats(liste) {
  const sets = liste.every((c) => c.set) ? null : await setsPokemon().catch(() => new Map());
  $("#carte-resultats").innerHTML = liste.map((c) => {
    const sid = c.id.slice(0, c.id.lastIndexOf("-"));
    const set = c.set ? { name: c.set.nom, cardCount: { official: c.set.total } } : sets.get(sid);
    const num = `${c.localId}${set?.cardCount?.official ? "/" + set.cardCount.official : ""}`;
    const visuel = c.image ? `<img src="${esc(c.image)}/low.webp" alt="" loading="lazy">` : vignetteProvisoire(c.name, num, set?.name);
    return `<button class="resultat" data-id="${esc(c.id)}">${visuel}<span>${esc(c.name)}</span><span class="infos">${esc(set?.name ?? sid)} · ${esc(num)}</span><span class="prix-tuile" data-prix="${esc(c.id)}"></span></button>`;
  }).join("");
  // Prix déjà connus : affichés dès qu'ils arrivent (« ? » sinon)
  prixConnus(liste.map((c) => c.id)).then((m) => {
    document.querySelectorAll("#carte-resultats .prix-tuile").forEach((el) => {
      const p = m.get(el.dataset.prix);
      el.textContent = p ? euro(p.prix) : "?";
      el.classList.toggle("inconnu", !p);
    });
  }).catch(() => {});
}
$("#carte-resultats").addEventListener("click", async (e) => {
  const b = e.target.closest(".resultat"); if (!b) return;
  $("#carte-statut").textContent = "Chargement de la carte…";
  try {
    const [fr, en] = await Promise.all([catalogue(`${TCG}/fr/cards/${b.dataset.id}`), catalogue(`${TCG}/en/cards/${b.dataset.id}`).catch(() => null)]);
    const cm = (fr.variants_detailed ?? []).map((v) => v.thirdParty?.cardmarket).find(Boolean) ?? null;
    ajout.choix = {
      tcgdex_id: fr.id, nom: fr.name, nom_en: en?.name ?? null,
      numero: `${fr.localId}/${fr.set?.cardCount?.official ?? "?"}`,
      rarete: RARETES[(fr.rarity ?? "").toLowerCase()] ?? fr.rarity ?? null,
      set_id: fr.set?.id, set_nom: fr.set?.name, set_nom_en: en?.set?.name ?? null,
      image: fr.image ? `${fr.image}/high.webp` : null, cardmarket_id: cm,
    };
    $("#ajout-choix").innerHTML = `${fr.image ? `<img src="${esc(fr.image)}/low.webp" alt="">` : vignetteProvisoire(fr.name, ajout.choix.numero, "")}<div><strong>${esc(fr.name)}</strong><br>
      <span class="infos">${esc(fr.set?.name)} · ${esc(ajout.choix.numero)} · ${esc(ajout.choix.rarete ?? "")}</span>${fr.image ? "" : `<br><span class="infos">Image pas encore disponible, elle s'ajoutera toute seule.</span>`}
      <p class="prix-choix" id="prix-choix">Prix Cardmarket FR : …</p></div>`;
    prixConnus([fr.id]).then((m) => {
      const p = m.get(fr.id), el = $("#prix-choix"); if (!el) return;
      el.innerHTML = p
        ? `Prix Cardmarket FR : <strong>${euro(p.prix)}</strong> <span class="infos">(relevé du ${new Date(p.le).toLocaleDateString("fr-FR")})</span>`
        : `Prix Cardmarket FR : <strong class="inconnu">?</strong> <span class="infos">relevé la nuit prochaine</span>`;
    }).catch(() => { const el = $("#prix-choix"); if (el) el.innerHTML = `Prix Cardmarket FR : <strong class="inconnu">?</strong>`; });
    $("#bloc-destination").hidden = false;
    ajout.destManuelle = false;
    proposerDestination(fr.rarity, null);
    prixConnus([fr.id]).then((m) => { const p = m.get(fr.id); if (p) proposerDestination(fr.rarity, Number(p.prix)); }).catch(() => {});
    $("#ajout-final").hidden = false;
    $("#carte-statut").textContent = "";
    $("#ajout-final").scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "nearest" });
  } catch (err) { $("#carte-statut").textContent = `Carte introuvable : ${err.message}`; }
});

// --- Scanner : reconnaissance par IA (Gemini), lecture du numéro en secours ---
const sansAccent = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function ressemblance(a, b) {
  const x = new Set(sansAccent(a).split(" ").filter(Boolean)), y = new Set(sansAccent(b).split(" ").filter(Boolean));
  if (!x.size || !y.size) return 0;
  let commun = 0; for (const m of x) if (y.has(m)) commun++;
  return commun / Math.max(x.size, y.size);
}
// Décodage de la photo : <img> d'abord (fiable sur iPhone, orientation EXIF appliquée), createImageBitmap en secours
function avecDelai(promesse, ms, quoi) {
  return Promise.race([promesse, new Promise((_, ko) => setTimeout(() => ko(new Error(`${quoi} trop long`)), ms))]);
}
async function decoderPhoto(f) {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.decoding = "async";
    await avecDelai(new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error("format de photo non lu")); img.src = url; }), 20000, "ouverture de la photo");
    return img;
  } catch (e1) {
    try { return await avecDelai(createImageBitmap(f), 20000, "ouverture de la photo"); }
    catch { throw e1; }
  } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
async function photoReduite(f, max = 1280) {
  const src = await decoderPhoto(f);
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.85);
  const image = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (image.length < 1000) throw new Error("photo vide");
  return { image, mime: "image/jpeg", bmp: c };
}

let scanEnCours = false;
$("#scan-photo").addEventListener("change", (e) => scannerPhoto(e.target.files?.[0], e.target));
// f : la photo (fichier ou image de la webcam) ; input : le champ à vider une fois la photo lue
async function scannerPhoto(f, input = null) {
  if (!f || scanEnCours) return;
  scanEnCours = true;
  ajout.scanIA = null;
  noterActivite("scan");
  const statut = $("#scan-statut");
  statut.classList.add("en-cours");
  statut.textContent = "Photo reçue, préparation… 📸";
  let photo;
  try {
    photo = await photoReduite(f);
    statut.textContent = "L'IA regarde ta photo… 🔍 (quelques secondes)";
    const { data: r, error } = await avecDelai(
      sb.functions.invoke("reconnaitre", { body: { image: photo.image, mime: photo.mime } }), 45000, "réponse de l'IA");
    if (error || !r || r.erreur) throw new Error(r?.erreur ?? error?.message ?? "pas de réponse");
    await appliquerReconnaissance(r);
  } catch (err) {
    statut.textContent = `L'IA n'a pas pu lire la photo (${err.message}).${photo ? " Lecture du numéro en secours…" : " Réessaie, ou cherche la carte par nom."}`;
    if (photo) await lectureNumero(photo.bmp);
  } finally {
    statut.classList.remove("en-cours");
    if (input) input.value = ""; // seulement après lecture (sur iPhone, vider avant rend la photo illisible)
    scanEnCours = false;
  }
}

async function appliquerReconnaissance(r) {
  const statut = $("#scan-statut");
  const jeu = r.jeu === "onepiece" ? "onepiece" : "pokemon";
  if (jeu !== etat.jeu) basculerJeu(jeu);
  const resume = [r.nom, r.numero && (r.total ? `${r.numero}/${r.total}` : r.numero), r.extension].filter(Boolean).join(" · ");
  statut.textContent = `Reconnu : ${resume || "objet incertain"}${r.confiance < 0.6 ? " (pas sûr, vérifie bien)" : ""}`;

  if (r.categorie === "scelle") {
    choisirType("scelle");
    await remplirExtensions();
    const cible = [r.code_extension, r.extension, r.nom].map(sansAccent).filter(Boolean);
    const ext = etat.extensions.filter((x) => x.jeu === etat.jeu)
      .map((x) => ({ x, score: Math.max(...cible.map((c) => Math.max(ressemblance(c, x.nom_fr), ressemblance(c, x.nom_en ?? ""), sansAccent(x.code) && c.includes(sansAccent(x.code)) ? 1 : 0))) }))
      .sort((a, b) => b.score - a.score)[0];
    if (ext?.score > 0.3) $("#sc-extension").value = String(ext.x.id);
    const types = [...$("#sc-type").options].map((o) => o.value);
    if (types.includes(r.type_scelle)) $("#sc-type").value = r.type_scelle;
    nomScelle();
    ajout.scanIA = { type: "scelle", sig: signatureScelle() };
    return;
  }

  choisirType("carte");
  if (jeu === "onepiece") {
    $("#op-numero").value = (r.numero ?? "").toUpperCase();
    if (r.langue && [...$("#op-langue").options].some((o) => o.value === r.langue)) $("#op-langue").value = r.langue;
    const liste = await chercherOP($("#op-numero").value);
    const motif = { alternative: /(Alternate|Parallel|Full Art)/i, manga: /Manga/i, sp: /\(SP\)/i }[r.version];
    const i = liste.findIndex((c) => motif ? motif.test(c.card_name) : !/\((Alternate|Parallel|Manga|SP|Full Art|Super|Wanted)/i.test(c.card_name));
    if (i >= 0) $(`#op-resultats .resultat[data-i="${i}"]`)?.click();
    else if (r.nom) $("#op-nom").value = r.nom;
    ajout.scanIA = { type: "onepiece", sig: i >= 0 ? liste[i].card_name : null };
    return;
  }

  // Pokémon : par numéro d'abord, puis par nom ; la plus ressemblante en premier
  let res = [];
  const num = String(r.numero ?? "").replace(/\s+/g, ""), tot = /^\w*\d+$/.test(String(r.total ?? "")) ? String(r.total) : "";
  try {
    const idx = await chargerIndex();
    if (num) res = rechercheLocale(idx, tot ? `${num}/${tot}` : num);
    if (!res.length && num) res = rechercheLocale(idx, num);
    if (!res.length && r.nom) res = rechercheLocale(idx, r.nom);
  } catch {
    if (num) {
      const brut = num.toUpperCase();
      res = await parNumero(/^(TG|GG|SV)/.test(brut) ? brut : brut.replace(/^0+(?=\d)/, ""), tot ? Number(tot) : null);
    }
    if (!res.length && r.nom) res = await catalogue(`${TCG}/fr/cards?name=${encodeURIComponent(r.nom.split(" ")[0])}`);
  }
  const classe = res.map((c) => ({ c, s: ressemblance(c.name, r.nom) + 0.5 * ressemblance(c.name, r.nom_en) }))
    .sort((a, b) => b.s - a.s).map((x) => x.c).slice(0, 40);
  $("#recherche-carte").value = r.numero ? `${r.numero}${r.total ? "/" + r.total : ""}` : (r.nom ?? "");
  await afficherResultats(classe);
  ajout.scanIA = { type: "pokemon", sig: classe[0]?.id ?? null };
  if (classe.length) {
    $("#carte-statut").textContent = "La première carte est la proposition de l'IA. Si ce n'est pas la bonne, touche la tienne.";
    $("#carte-resultats .resultat")?.click();
  } else $("#carte-statut").textContent = "Aucune carte correspondante dans le catalogue. Cherche par nom ci-dessous.";
}

function basculerJeu(jeu) {
  etat.jeu = jeu;
  marquerJeu(jeu);
  $("#ajout-titre").textContent = `Ajouter à la collection ${NOM_JEU[jeu]}`;
  dessinerCollection();
}

// Secours sans IA : lecture du numéro en bas de la carte
let tesseract = null;
function chargerTesseract() {
  if (tesseract) return tesseract;
  tesseract = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => ok(window.Tesseract); s.onerror = () => ko(new Error("lecteur indisponible"));
    document.head.appendChild(s);
  });
  return tesseract;
}
function bandeBasse(bitmap, part) {
  const sy = Math.round(bitmap.height * (1 - part)), sh = bitmap.height - sy, k = Math.max(1, 1600 / bitmap.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * k); c.height = Math.round(sh * k);
  const g = c.getContext("2d");
  g.filter = "grayscale(1) contrast(1.8)";
  g.drawImage(bitmap, 0, sy, bitmap.width, sh, 0, 0, c.width, c.height);
  return c;
}
async function lectureNumero(bmp) {
  const statut = $("#scan-statut");
  try {
    const T = await chargerTesseract();
    const w = await T.createWorker("eng");
    await w.setParameters({ tessedit_char_whitelist: "0123456789/TGSVHPMER " });
    let trouve = null;
    for (const part of [0.14, 0.25, 1]) {
      const { data } = await w.recognize(bandeBasse(bmp, part));
      trouve = data.text.match(/(TG|GG)?\s?0*(\d{1,3})\s*\/\s*(?:TG|GG)?\s?(\d{2,3})/i);
      if (trouve) break;
    }
    await w.terminate();
    if (!trouve) { statut.textContent = "Photo illisible. Réessaie avec plus de lumière, ou tape le numéro (ex. 144/131)."; return; }
    const texte = `${trouve[1] ?? ""}${trouve[2]}/${trouve[3]}`;
    choisirType("carte");
    $("#recherche-carte").value = texte;
    statut.textContent = `Numéro lu : ${texte}.`;
    await chercherCartes(texte);
  } catch (err) { statut.textContent = `Scanner indisponible : ${err.message}. Tape le numéro à la place.`; }
}

// --- One Piece : trouver l'image et le nom par le numéro ---
$("#op-chercher").addEventListener("click", () => chercherOP($("#op-numero").value));
async function chercherOP(saisie) {
  const n = saisie.trim().toUpperCase(); if (!n) return [];
  const statut = $("#op-statut");
  statut.textContent = "Recherche…";
  const type = n.startsWith("ST") ? "decks" : n.startsWith("P-") ? "promos" : "sets";
  try {
    const l = await catalogue(`https://optcgapi.com/api/${type}/card/${n}/`);
    const liste = Array.isArray(l) ? l : [];
    $("#op-resultats").innerHTML = liste.map((c, i) => `<button class="resultat" data-i="${i}"><img src="${esc(c.card_image)}" alt="" loading="lazy"><span>${esc(c.card_name)}</span></button>`).join("");
    ajout.opListe = liste;
    statut.textContent = liste.length ? "Touche la bonne version (normale, alternative, manga…)." : "Aucune carte trouvée pour ce numéro. Remplis le nom à la main.";
    return liste;
  } catch (err) { statut.textContent = `Recherche impossible : ${err.message}. Remplis le nom à la main.`; return []; }
}
$("#op-resultats").addEventListener("click", (e) => {
  const b = e.target.closest(".resultat"); if (!b) return;
  const c = ajout.opListe[Number(b.dataset.i)];
  ajout.opImage = c.card_image; ajout.opChoisi = c.card_name;
  $("#op-nom").value = c.card_name.replace(/\s*\((Alternate Art|Parallel|Manga|SP|Full Art)\)/gi, "").replace(/\./g, " ").replace(/\s+/g, " ").trim();
  const n = c.card_name;
  $("#op-rarete").value = /Manga/i.test(n) ? "Manga" : /\(SP\)/i.test(n) ? "SP" : /(Alternate|Parallel|Full Art)/i.test(n) ? "Parallèle"
    : ({ L: "Leader", SR: "SR", SEC: "SEC", R: "R", UC: "UC", C: "C", TR: "TR", P: "Promo" }[c.rarity] ?? "SR");
  $("#op-resultats").querySelectorAll(".resultat").forEach((x) => x.classList.toggle("choisi", x === b));
});

// --- Valider ---
$("#bouton-valider").addEventListener("click", async () => {
  const msg = $("#ajout-message"), q = Math.max(1, Number($("#aj-quantite").value) || 1);
  const prix = $("#aj-prix").value === "" ? null : Number($("#aj-prix").value);
  let r;
  if (ajout.type === "scelle") {
    const type = $("#sc-type").value, demi = type === "Demi Display";
    r = await sb.rpc("ajouter_scelle", {
      p_jeu: etat.jeu, p_extension_id: Number($("#sc-extension").value) || null,
      p_type: demi ? "Display" : type, p_variante: demi ? "Demi (18 boosters)" : $("#sc-variante").value,
      p_nom: $("#sc-nom").value.trim(), p_quantite: q, p_prix_achat: prix, p_defaut: $("#sc-defaut").checked,
    });
  } else if (etat.jeu === "pokemon" && ajout.destination === "classeur") {
    if (!ajout.choix) { msg.textContent = "Choisis d'abord ta carte dans la liste."; return; }
    r = await sb.rpc("classeur_modifier", { p_tcgdex_id: ajout.choix.tcgdex_id, p_delta: q });
    if (r.error) { msg.textContent = `Ajout impossible : ${r.error.message}`; return; }
    msg.textContent = "Rangée dans le Classeur ✅";
    noterIssueScan();
    verifierBadges();
    await chargerClasseur();
    if (!$("#vue-classeur").hidden) etat.setOuvert ? ouvrirSet(etat.setOuvert) : dessinerClasseurListe();
    setTimeout(() => $("#ajout").close(), 900);
    return;
  } else if (etat.jeu === "pokemon") {
    if (!ajout.choix) { msg.textContent = "Choisis d'abord ta carte dans la liste."; return; }
    const c = ajout.choix;
    r = await sb.rpc("ajouter_carte_pokemon", {
      p_tcgdex_id: c.tcgdex_id, p_nom: c.nom, p_nom_en: c.nom_en, p_numero: c.numero, p_rarete: c.rarete,
      p_set_id: c.set_id, p_set_nom: c.set_nom, p_set_nom_en: c.set_nom_en, p_image: c.image, p_cardmarket_id: c.cardmarket_id,
      p_quantite: q, p_etat: $("#aj-etat").value, p_prix_achat: prix, p_langue: "FR",
    });
  } else {
    const numero = $("#op-numero").value.trim().toUpperCase(), nom = $("#op-nom").value.trim();
    if (!numero || !nom) { msg.textContent = "Indique au moins le numéro et le nom de la carte."; return; }
    r = await sb.rpc("ajouter_carte_onepiece", {
      p_numero: numero, p_nom: nom, p_rarete: $("#op-rarete").value, p_extension_code: numero.startsWith("P-") ? "PROMO" : numero.split("-")[0],
      p_langue: $("#op-langue").value, p_image: ajout.opImage ?? null, p_quantite: q, p_prix_achat: prix,
    });
  }
  if (r.error) { msg.textContent = `Ajout impossible : ${r.error.message}`; return; }
  msg.textContent = "Ajouté ✅ Le prix s'affichera après le relevé de cette nuit.";
  noterIssueScan();
  await chargerCollection();
  setTimeout(() => $("#ajout").close(), 900);
});

/* ================= Classeur : remplir ses extensions =================
   Collection = la valeur (ex, promos, illustrations… ou plus de 2 €).
   Classeur = toutes les cartes d'une extension, communes comprises, pour la compléter. */
const RARETES_COMMUNES = /^(commune|peu commune|rare|holo rare|rare holo|sans rareté|aucune)$/i;
const SEUIL_COLLECTION = 2; // €
etat.classeur = new Map(); etat.setOuvert = null; etat.csFiltre = ""; etat.prixSet = new Map();

function marquerDestination(d, aide) {
  ajout.destination = d;
  $("#aj-destination").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === d)));
  if (aide !== undefined) $("#aj-destination-aide").textContent = aide;
  const cl = d === "classeur";
  $("#aj-prix").closest("div").hidden = cl;
  $("#bloc-etat").hidden = cl || ajout.type !== "carte";
}
function proposerDestination(rarete, prix) {
  if (ajout.destManuelle) return;
  const commune = RARETES_COMMUNES.test(String(rarete ?? "").trim());
  if (!commune) return marquerDestination("collection", "Carte rare (ex, promo, illustration…) : rangée dans ta Collection.");
  if (prix >= SEUIL_COLLECTION) return marquerDestination("collection", `Carte commune, mais elle vaut plus de ${SEUIL_COLLECTION} € : rangée dans ta Collection.`);
  marquerDestination("classeur", "Carte commune à petit prix : rangée dans ton Classeur.");
}
$("#aj-destination").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  ajout.destManuelle = true;
  marquerDestination(b.dataset.val, b.dataset.val === "classeur" ? "Tu la ranges dans ton Classeur." : "Tu la ranges dans ta Collection.");
});

async function chargerClasseur() {
  if (!etat.moi) return;
  const { data } = await sb.from("classeur").select("tcgdex_id, set_id, quantite").eq("membre_id", etat.moi.id);
  etat.classeur = new Map((data ?? []).map((x) => [x.tcgdex_id, x]));
}
const rangNum = (c) => { const n = parseInt(c.localId, 10); return isNaN(n) ? 100000 : n; };
function compteSet(idx, sid) {
  const set = idx.sets.get(sid);
  const cartes = idx.cartes.filter((c) => c.set?.id === sid).sort((a, b) => rangNum(a) - rangNum(b) || String(a.localId).localeCompare(String(b.localId)));
  const off = set?.total || cartes.length;
  let normales = 0, secretes = 0, nbSec = 0;
  for (const c of cartes) {
    const n = parseInt(c.localId, 10), sec = !(n >= 1 && n <= off) || !/^\d+$/.test(String(c.localId));
    if (sec) nbSec++;
    if (etat.classeur.has(c.id)) sec ? secretes++ : normales++;
  }
  return { set, cartes, off, normales, secretes, nbSec, pct: off ? Math.round((normales / off) * 100) : 0 };
}
function ligneSet(idx, sid) {
  const k = compteSet(idx, sid);
  return `<li><button type="button" class="set" data-set="${esc(sid)}"${sid === etat.setOuvert ? ' aria-current="true"' : ""}>
    <span class="set-nom">${esc(k.set?.nom ?? sid)}</span>
    <span class="set-compte">${k.normales}/${k.off}${k.secretes ? ` <small>+${k.secretes} secrètes</small>` : ""}</span>
    <span class="barre-prog" aria-hidden="true"><span style="width:${k.pct}%"></span></span></button></li>`;
}
async function dessinerClasseurListe() {
  etat.setOuvert = null; marquerSetOuvert();
  $("#classeur-set").hidden = true; $("#classeur-liste").hidden = false;
  let idx;
  try { idx = await chargerIndex(); }
  catch { $("#classeur-sets").innerHTML = `<li class="vide">Le catalogue des cartes n'a pas pu être chargé. Réessaie dans un instant.</li>`; return; }
  const sids = [...new Set([...etat.classeur.values()].map((x) => x.set_id))]
    .sort((a, b) => (idx.sets.get(b)?.ordre ?? 0) - (idx.sets.get(a)?.ordre ?? 0));
  $("#classeur-sets").innerHTML = sids.length ? sids.map((sid) => ligneSet(idx, sid)).join("")
    : `<li class="vide">Ton classeur est vide. Ouvre une extension ci-dessus, ou scanne une carte et range-la dans le Classeur.</li>`;
  if (aAnimer.delete("classeur")) animerListe($("#classeur-sets").children, 500, 120, "bloc");
}
$("#classeur-recherche").addEventListener("input", async (e) => {
  const q = sansAccent(e.target.value);
  if (q.length < 2) { $("#classeur-trouves").innerHTML = ""; return; }
  const idx = await chargerIndex().catch(() => null); if (!idx) return;
  const sets = [...idx.sets.values()].filter((x) => sansAccent(x.nom).includes(q)).sort((a, b) => b.ordre - a.ordre).slice(0, 12);
  $("#classeur-trouves").innerHTML = sets.length ? sets.map((x) => ligneSet(idx, x.id)).join("") : `<li class="vide">Aucune extension ne correspond.</li>`;
});
document.querySelector("#vue-classeur").addEventListener("click", (e) => {
  const b = e.target.closest(".set"); if (b) ouvrirSet(b.dataset.set, true);
});
$("#classeur-retour").addEventListener("click", () => {
  $("#classeur-recherche").value = ""; $("#classeur-trouves").innerHTML = "";
  $("#classeur-set").hidden = true; $("#classeur-liste").hidden = false; scrollTo({ top: 0 });
  entreeVue("classeur"); dessinerClasseurListe();
});
$("#cs-filtre").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  etat.csFiltre = b.dataset.val;
  $("#cs-filtre").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  dessinerSet(await chargerIndex());
});

async function ouvrirSet(sid, entree = false) {
  const idx = await chargerIndex();
  if (etat.setOuvert !== sid) { etat.prixSet = new Map(); etat.csFiltre = ""; $("#cs-filtre").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.val === ""))); }
  etat.setOuvert = sid;
  $("#classeur-liste").hidden = true; $("#classeur-set").hidden = false;
  marquerSetOuvert();
  dessinerSet(idx);
  if (entree) {
    debutEntree = performance.now();
    const t = entreeBlocs($("#classeur-set"));
    animerListe($("#cs-cartes").children, t + 120);
  }
  const ids = idx.cartes.filter((c) => c.set?.id === sid).map((c) => c.id);
  prixConnus(ids).then((m) => {
    if (etat.setOuvert !== sid) return;
    etat.prixSet = m;
    if (etat.csFiltre === "manque") return dessinerSet(idx); // tri par prix : il faut tout redessiner
    $("#cs-cartes").querySelectorAll(".cc").forEach((b) => { const p = m.get(b.dataset.id); b.querySelector(".cc-bas span:last-child").textContent = p ? euro(p.prix) : ""; });
  }).catch(() => {});
}
function dessinerSet(idx) {
  const k = compteSet(idx, etat.setOuvert);
  ecrireTitre($("#cs-titre"), k.set?.nom ?? etat.setOuvert);
  $("#cs-barre").style.width = `${k.pct}%`;
  $("#cs-compte").textContent = `${k.normales}/${k.off} cartes (${k.pct} %)${k.nbSec ? ` · secrètes : ${k.secretes}/${k.nbSec}` : ""}`;
  const prix = (c) => Number(etat.prixSet.get(c.id)?.prix ?? -1);
  let l = k.cartes;
  if (etat.csFiltre === "manque") l = l.filter((c) => !etat.classeur.has(c.id)).sort((a, b) => prix(b) - prix(a));
  if (etat.csFiltre === "ai") l = l.filter((c) => etat.classeur.has(c.id));
  $("#cs-cartes").innerHTML = l.length ? l.map((c) => {
    const x = etat.classeur.get(c.id), p = etat.prixSet.get(c.id);
    return `<button type="button" class="cc ${x ? "ai" : "manque"}" data-id="${esc(c.id)}" aria-pressed="${!!x}" aria-label="${esc(c.name)} ${esc(c.localId)}">
      <span class="cc-img">${c.image ? `<img loading="lazy" src="${esc(c.image)}/low.webp" alt="">` : `<span class="cc-sans">${esc(c.name)}</span>`}</span>
      ${x && x.quantite > 1 ? `<span class="quantite">×${x.quantite}</span>` : ""}
      <span class="cc-bas"><span>${esc(c.localId)}</span><span>${p ? euro(p.prix) : ""}</span></span></button>`;
  }).join("") : `<p class="vide">${etat.csFiltre === "manque" ? "Il ne te manque aucune carte. Bravo !" : "Aucune carte cochée pour l'instant."}</p>`;
}
$("#cs-cartes").addEventListener("click", async (e) => {
  const b = e.target.closest(".cc"); if (!b) return;
  const id = b.dataset.id, x = etat.classeur.get(id), delta = x ? -x.quantite : 1;
  // affichage immédiat, puis enregistrement
  if (x) etat.classeur.delete(id); else etat.classeur.set(id, { tcgdex_id: id, set_id: etat.setOuvert, quantite: 1 });
  const idx = await chargerIndex(); dessinerSet(idx);
  const { error } = await sb.rpc("classeur_modifier", { p_tcgdex_id: id, p_delta: delta });
  if (error) { await chargerClasseur(); dessinerSet(idx); $("#cs-compte").textContent = `Pas enregistré : ${error.message}. Réessaie.`; }
  else verifierBadges();
});

/* ================= Badges =================
   Les 30 badges sont décrits dans badges.js (un seul objet de configuration).
   Ici : le journal d'activité, le calcul des conditions, le déblocage et la page « Mes badges ».
   Un badge gagné est enregistré dans badges_obtenus et n'est jamais retiré.
   Si Supabase répond mal, on ne montre rien et on réessaiera à la prochaine action. */
etat.badges = new Map(); etat.activite = []; etat.ventes = []; etat.journalPret = false; etat.donnees = null;
const lireLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrireLocal = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const jourLocal = (d) => new Date(d).toLocaleDateString("fr-CA"); // AAAA-MM-JJ, à l'heure du téléphone

async function chargerJournal() {
  etat.journalPret = false;
  try {
    const id = etat.moi?.id; if (!id) return;
    const [a, b, v] = await Promise.all([
      sb.from("activite").select("type, le").eq("membre_id", id).order("le").limit(20000),
      sb.from("badges_obtenus").select("badge_id, obtenu_le").eq("membre_id", id),
      sb.from("ventes").select("quantite, prix_vente, prix_achat, frais").eq("membre_id", id),
    ]);
    if (b.error || a.error) throw b.error ?? a.error; // sans la liste des badges déjà gagnés, on ne décerne rien
    etat.badges = new Map((b.data ?? []).map((x) => [x.badge_id, x.obtenu_le]));
    etat.activite = a.data ?? [];
    etat.ventes = v.error ? [] : (v.data ?? []);
    etat.journalPret = true;
    majAvatar();
    // Une ouverture au plus par heure
    const derniere = etat.activite.filter((x) => x.type === "ouverture").at(-1);
    if (!derniere || Date.now() - new Date(derniere.le).getTime() > 36e5) noterActivite("ouverture");
  } catch (e) { console.warn("Badges indisponibles pour l'instant :", e?.message ?? e); }
}

async function noterActivite(type, detail = null) {
  if (!etat.moi) return;
  etat.activite.push({ type, le: new Date().toISOString() });
  try {
    const { error } = await sb.from("activite").insert({ membre_id: etat.moi.id, type, detail });
    if (error) console.warn("Activité non enregistrée :", error.message);
  } catch (e) { console.warn("Activité non enregistrée :", e?.message ?? e); }
  if (type !== "ouverture") verifierBadges();
}

// Scan : l'IA propose, on regarde si sa proposition est gardée au moment de valider
const signatureScelle = () => `${$("#sc-extension").value}|${$("#sc-type").value}`;
function noterIssueScan() {
  const s = ajout.scanIA; ajout.scanIA = null;
  if (!s) return;
  const choisi = s.type === "scelle" ? (ajout.type === "scelle" ? signatureScelle() : null)
    : s.type === "onepiece" ? ajout.opChoisi ?? null : ajout.choix?.tcgdex_id ?? null;
  noterActivite(s.sig != null && choisi === s.sig ? "scan_reconnu" : "scan_corrige");
}

// Statistiques du Classeur (Pokémon) : progression de chaque extension
async function statsClasseur() {
  const r = { cartes: etat.classeur.size, quantite: 0, meilleurePct: 0, extensions50: 0, secretes: false, noms: [] };
  for (const x of etat.classeur.values()) r.quantite += x.quantite ?? 1;
  if (!etat.classeur.size) return r;
  try {
    const idx = await chargerIndex();
    for (const sid of new Set([...etat.classeur.values()].map((x) => x.set_id))) {
      const k = compteSet(idx, sid);
      r.meilleurePct = Math.max(r.meilleurePct, k.pct);
      if (k.pct >= 50) r.extensions50++;
      if (k.nbSec > 0 && k.secretes === k.nbSec) r.secretes = true;
      if (k.set?.nom) r.noms.push(k.set.nom);
    }
  } catch {}
  return r;
}

// Sniper : prix d'achat au moins 20 % sous le prix du marché le jour de l'achat
async function compterSniper() {
  const lignes = (etat.lignes ?? []).filter((x) => x.achete_le && Number(x.prix_achat) > 0);
  if (!lignes.length) return 0;
  const cle = lignes.map((x) => `${x.produit_id}@${x.achete_le}`).sort().join(",");
  if (etat.sniperCache?.cle === cle) return etat.sniperCache.n;
  const { data, error } = await sb.from("prix").select("produit_id, le, prix, etat_prix")
    .in("produit_id", [...new Set(lignes.map((x) => x.produit_id))]).eq("valide", true).order("le");
  if (error) return 0;
  let n = 0;
  for (const x of lignes) {
    const h = (data ?? []).filter((p) => p.produit_id === x.produit_id && p.etat_prix === (x.defaut ? "defaut" : "standard"));
    const avant = h.filter((p) => p.le <= x.achete_le).at(-1);
    const apres = h.find((p) => p.le > x.achete_le && (new Date(p.le) - new Date(x.achete_le)) <= 7 * 864e5);
    const marche = Number((avant ?? apres)?.prix);
    if (marche > 0 && Number(x.prix_achat) <= marche * 0.8) n++;
  }
  etat.sniperCache = { cle, n };
  return n;
}

function donneesBadges(cl, sniper) {
  const a = etat.activite, lignes = etat.lignes ?? [], maintenant = Date.now();
  const somme = (l) => l.reduce((t, x) => t + (Number(x.quantite) || 0), 0);
  const scans = a.filter((x) => x.type === "scan");
  const parJour = new Map();
  for (const x of scans) { const j = jourLocal(x.le); parJour.set(j, (parJour.get(j) ?? 0) + 1); }
  let suite = 0, meilleureSuite = 0;
  for (const x of a) {
    if (x.type === "scan_reconnu") meilleureSuite = Math.max(meilleureSuite, ++suite);
    else if (x.type === "scan_corrige") suite = 0;
  }
  const cartes = lignes.filter((x) => x.categorie === "carte");
  const ouvertures = [...a.filter((x) => x.type === "ouverture").map((x) => new Date(x.le)), new Date()];
  const gains = lignes.filter((x) => Number(x.prix_achat) > 0 && x.prix_actuel != null).map((x) => (Number(x.prix_actuel) / Number(x.prix_achat) - 1) * 100);
  const achats = lignes.filter((x) => x.achete_le).map((x) => Math.floor((maintenant - new Date(x.achete_le)) / 864e5));
  const extensions = new Set([...cartes.map((x) => x.extension).filter(Boolean), ...cl.noms].map(sansAccent));
  return {
    scans: scans.length,
    scansJourMax: Math.max(0, ...parJour.values()),
    reconnusSuite: meilleureSuite,
    cartes: somme(cartes),
    scelles: somme(lignes.filter((x) => x.categorie === "scelle")),
    prixMax: Math.max(0, ...cartes.map((x) => Number(x.prix_actuel) || 0)),
    classeurCartes: cl.cartes, meilleurePct: cl.meilleurePct, extensions50: cl.extensions50, secretesCompletes: cl.secretes,
    extensions: extensions.size,
    cartesPokemon: somme(cartes.filter((x) => x.jeu === "pokemon")) + cl.quantite,
    cartesOnePiece: somme(cartes.filter((x) => x.jeu === "onepiece")),
    gainMaxPct: gains.length ? Math.max(...gains) : -100,
    sniper,
    detentionJours: Math.max(0, ...achats),
    ventes: etat.ventes.length,
    ventesGagnantes: etat.ventes.filter((v) => v.prix_achat != null && Number(v.prix_vente) * (v.quantite ?? 1) > Number(v.prix_achat) * (v.quantite ?? 1) + Number(v.frais ?? 0)).length,
    heures: ouvertures.map((d) => d.getHours()),
    joursOuverture: new Set(ouvertures.map(jourLocal)).size,
    anciennete: etat.moi?.cree_le ? maintenant - new Date(etat.moi.cree_le).getTime() : 0,
  };
}
const mesurer = (b, d) => { try { return Number(b.mesure(d)) || 0; } catch { return 0; } };

// Vérification : au chargement et après chaque action (regroupée pour ne pas surcharger)
let minuterieBadges = 0, verifEnCours = false, verifRelance = false;
function verifierBadges() { clearTimeout(minuterieBadges); minuterieBadges = setTimeout(lancerVerification, 400); }
async function lancerVerification() {
  if (!etat.moi || !etat.journalPret) return;
  if (verifEnCours) { verifRelance = true; return; }
  verifEnCours = true;
  try {
    await chargerClasseur().catch(() => {});
    const [cl, sniper] = await Promise.all([statsClasseur(), compterSniper().catch(() => 0)]);
    const d = etat.donnees = donneesBadges(cl, sniper);
    const nouveaux = BADGES.filter((b) => !etat.badges.has(b.id) && mesurer(b, d) >= b.cible);
    const cleInit = `badges-init-${etat.moi.id}`;
    const premierLancement = etat.badges.size === 0 && !lireLocal(cleInit);
    if (nouveaux.length) {
      const le = new Date().toISOString();
      const { error } = await sb.from("badges_obtenus")
        .upsert(nouveaux.map((b) => ({ membre_id: etat.moi.id, badge_id: b.id, obtenu_le: le })), { onConflict: "membre_id,badge_id", ignoreDuplicates: true });
      if (error) throw error;
      nouveaux.forEach((b) => etat.badges.set(b.id, le));
      if (premierLancement) message(`Tu as déjà gagné ${nouveaux.length} badge${nouveaux.length > 1 ? "s" : ""} ! Retrouve-les en touchant ton avatar.`);
      else annoncer(nouveaux);
    }
    ecrireLocal(cleInit, "1");
    majAvatar();
    if (!$("#vue-badges").hidden) dessinerMesBadges();
  } catch (e) { console.warn("Vérification des badges reportée :", e?.message ?? e); }
  finally {
    verifEnCours = false;
    if (verifRelance) { verifRelance = false; verifierBadges(); }
  }
}

function majAvatar() {
  $("#bouton-badges").setAttribute("aria-label", `Mes badges : ${etat.badges.size} sur ${BADGES.length}`);
}

// Message bref (premier lancement)
let minuterieMessage = 0;
function message(texte) {
  const t = $("#toast");
  t.textContent = texte; t.hidden = false;
  animer(t, "bouton", 0);
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => { t.hidden = true; }, 6000);
}

/* ---------- Déblocage : plein écran, un badge après l'autre ---------- */
const fileBadges = [];
function annoncer(badges) {
  fileBadges.push(...[...badges].sort((a, b) => RARETES_BADGES[a.rarete].rang - RARETES_BADGES[b.rarete].rang));
  if ($("#deblocage").open) return;
  // On laisse finir l'animation d'ouverture avant d'interrompre
  setTimeout(badgeSuivant, Math.max(300, debutEntree + 3000 - performance.now()));
}
function badgeSuivant() {
  if ($("#deblocage").open) return;
  const b = fileBadges.shift();
  if (b) montrerBadge(b, true);
}
$("#deblocage").addEventListener("close", () => { if (fileBadges.length) setTimeout(badgeSuivant, 350); });

const dateLongue = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dateCourte = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function progres(b) {
  if (!b.unite || !etat.donnees) return "";
  return `${Math.min(mesurer(b, etat.donnees), b.cible)} / ${b.cible}${b.unite === "%" ? " %" : ` ${b.unite}`}`;
}
const masque = (b) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" overflow="visible">${b.dessin}</svg>`)}")`;

function montrerBadge(b, deblocage = false) {
  const obtenu = etat.badges.get(b.id), cache = b.secret && !obtenu, rarete = RARETES_BADGES[b.rarete];
  const c = $("#deb-contenu");
  c.innerHTML = `
    <div class="deb-badge ${obtenu ? "" : "verrouille"}">
      <div class="deb-svg">${svgBadge(b, { verrouille: cache, label: cache ? "Badge secret" : undefined })}</div>
      ${obtenu && b.rarete === "holo" ? `<span class="reflet" style='--masque:${masque(b)}'></span>` : ""}
    </div>
    <p class="deb-statut">${deblocage ? "Nouveau badge débloqué" : obtenu ? `Obtenu le ${dateLongue(obtenu)}` : "Pas encore obtenu"}</p>
    <h2 id="deb-nom">${cache ? "???" : esc(b.nom)}</h2>
    <span class="rarete rarete-${b.rarete}">${rarete.nom} · ${esc(b.famille)}</span>
    <p class="deb-condition">${cache ? "Badge secret : continue d'utiliser PokeVibes pour le découvrir." : esc(b.condition)}</p>
    ${!obtenu && !cache && progres(b) ? `<p class="deb-progres">${progres(b)}</p>` : ""}
    <form method="dialog"><button class="bouton-principal" autofocus>${deblocage ? "Super" : "Fermer"}</button></form>`;
  preparerRoll(c.querySelector(".bouton-principal"));
  $("#deblocage").showModal();
  // Animation de la référence : de petit, penché et flou à un léger rebond, puis taille normale
  debutEntree = performance.now();
  const badge = c.querySelector(".deb-badge");
  if (calme) animer(badge, "bloc", 0);
  else if (deblocage) badge.animate([
    { transform: "scale(.3) rotate(-25deg)", filter: "blur(6px)", opacity: 0 },
    { transform: "scale(1.18) rotate(4deg)", filter: "blur(0)", opacity: 1, offset: .65 },
    { transform: "scale(1) rotate(0)", opacity: 1 }], { duration: 1100, easing: EZ, fill: "backwards" });
  else animer(badge, "embleme", 0);
  [".deb-statut", "#deb-nom", ".rarete", ".deb-condition", ".deb-progres", "form"].forEach((s, i) => animer(c.querySelector(s), "bloc", (deblocage ? 500 : 150) + i * 110));
}

/* ---------- Page « Mes badges » ---------- */
$("#bouton-badges").addEventListener("click", () => montrerVue("badges"));
$("#badges-retour").addEventListener("click", () => montrerVue(etat.vueAvant ?? "collection"));
function dessinerMesBadges() {
  const n = BADGES.filter((b) => etat.badges.has(b.id)).length;
  $("#badges-nb").textContent = n;
  $("#badges-total").textContent = `/ ${BADGES.length}`;
  $("#badges-barre").style.width = `${(n / BADGES.length) * 100}%`;
  $("#badges-familles").innerHTML = FAMILLES.map((f) => {
    const l = BADGES.filter((b) => b.famille === f); if (!l.length) return "";
    const nf = l.filter((b) => etat.badges.has(b.id)).length;
    return `<section class="famille"><h3 class="sous-titre">${esc(f)} <span>${nf} / ${l.length}</span></h3><div class="grille-badges">${l.map((b) => {
      const obtenu = etat.badges.get(b.id), cache = b.secret && !obtenu, p = progres(b);
      const etatTexte = obtenu ? dateCourte(obtenu) : cache ? "Secret" : p || RARETES_BADGES[b.rarete].nom;
      const pct = !obtenu && b.unite && etat.donnees ? Math.min(100, (mesurer(b, etat.donnees) / b.cible) * 100) : null;
      const lu = cache ? "Badge secret, pas encore découvert"
        : `${b.nom}, ${RARETES_BADGES[b.rarete].nom}, ${obtenu ? `obtenu le ${dateLongue(obtenu)}` : `pas encore obtenu${p ? ` : ${p}` : ""}`}`;
      return `<button type="button" class="badge-item ${obtenu ? "obtenu" : "verrouille"}" data-badge="${b.id}" aria-label="${esc(lu)}">
        <span class="badge-svg" aria-hidden="true">${svgBadge(b, { verrouille: cache })}</span>
        <span class="badge-nom">${cache ? "???" : esc(b.nom)}</span>
        <span class="badge-etat">${esc(etatTexte)}</span>
        ${pct != null && !cache ? `<span class="barre-prog" aria-hidden="true"><span style="width:${pct}%"></span></span>` : ""}
      </button>`;
    }).join("")}</div></section>`;
  }).join("");
  if (aAnimer.delete("badges")) {
    $("#badges-familles").querySelectorAll(".famille h3, .badge-item").forEach((el, i) => animer(el, el.matches("h3") ? "bloc" : "carte", 300 + Math.min(i, 14) * 70));
  }
}
$("#badges-familles").addEventListener("click", (e) => {
  const b = e.target.closest(".badge-item"); if (b) montrerBadge(BADGES.find((x) => x.id === b.dataset.badge));
});

/* ---------- L'Équipage : nombre de badges et les 3 plus rares ---------- */
async function badgesDesMembres() {
  const parPseudo = new Map();
  try {
    const [o, m] = await Promise.all([sb.from("badges_obtenus").select("membre_id, badge_id, obtenu_le"), sb.from("membres").select("id, pseudo")]);
    if (o.error || m.error) return parPseudo;
    const pseudo = new Map((m.data ?? []).map((x) => [x.id, x.pseudo]));
    for (const x of o.data ?? []) {
      const b = BADGES.find((y) => y.id === x.badge_id), p = pseudo.get(x.membre_id);
      if (!b || !p) continue;
      if (!parPseudo.has(p)) parPseudo.set(p, []);
      parPseudo.get(p).push({ b, le: x.obtenu_le });
    }
  } catch {}
  return parPseudo;
}
function resumeBadges(l) {
  if (!l?.length) return "";
  const rares = [...l].sort((x, y) => RARETES_BADGES[y.b.rarete].rang - RARETES_BADGES[x.b.rarete].rang || new Date(x.le) - new Date(y.le)).slice(0, 3);
  return `<span class="badges-membre" role="img" aria-label="${l.length} badge${l.length > 1 ? "s" : ""}, dont ${esc(rares.map((x) => x.b.nom).join(", "))}">
    ${rares.map((x) => svgBadge(x.b).replace('role="img"', 'aria-hidden="true"')).join("")}<span class="infos">${l.length} badge${l.length > 1 ? "s" : ""}</span></span>`;
}

/* ================= Tablette et PC =================
   Sous 700 px, rien de tout cela ne change l'affichage : l'expérience iPhone reste identique. */
const PC = matchMedia("(min-width: 900px)");
const GRAND_ECRAN = matchMedia("(min-width: 1200px)");
const SOURIS = matchMedia("(min-width: 700px) and (hover: hover) and (pointer: fine)");

// Fiche : panneau à droite de la liste (≥ 1200 px, la liste reste utilisable), sinon fenêtre comme avant
function ouvrirFenetreFiche() {
  const f = $("#fiche"), panneau = GRAND_ECRAN.matches;
  if (f.open && f.classList.contains("panneau") === panneau) return; // déjà ouverte : le contenu vient d'être remplacé
  if (f.open) f.close();
  f.classList.toggle("panneau", panneau);
  document.body.classList.toggle("avec-panneau", panneau);
  if (panneau) f.show(); else f.showModal();
}
$("#fiche").addEventListener("close", () => document.body.classList.remove("avec-panneau"));
GRAND_ECRAN.addEventListener?.("change", () => { if ($("#fiche").open && $("#fiche").classList.contains("panneau")) $("#fiche").close(); });

function marquerSetOuvert() {
  document.querySelectorAll("#vue-classeur .set").forEach((b) => {
    if (b.dataset.set === etat.setOuvert) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
  });
}

// « Text roll » sur les liens de la barre latérale (PC seulement : rien ne change sur iPhone)
function rollBarreLaterale() { if (PC.matches) document.querySelectorAll(".nav-item").forEach(preparerRoll); }
rollBarreLaterale();
PC.addEventListener?.("change", rollBarreLaterale);

// Raccourcis clavier : « / » cherche, Échap ferme le panneau de la fiche (les fenêtres se ferment déjà avec Échap)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const f = $("#fiche");
    if (f.open && f.classList.contains("panneau") && !$("#ajout").open && !$("#deblocage").open) { e.preventDefault(); f.close(); }
    return;
  }
  if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  if ($("#deblocage").open) return;
  const visible = (el) => el && el.offsetParent !== null;
  let champ = $("#ajout").open ? $("#recherche-carte") : [$("#recherche"), $("#classeur-recherche")].find(visible);
  if (!$("#ajout").open && !visible(champ)) { montrerVue("collection"); champ = $("#recherche"); }
  if (!champ || (!visible(champ) && !$("#ajout").open)) return;
  e.preventDefault();
  champ.focus(); champ.select?.();
});

// Scanner sur PC : choisir un fichier
$("#choisir-fichier").addEventListener("click", () => $("#scan-fichier").click());
$("#scan-fichier").addEventListener("change", (e) => scannerPhoto(e.target.files?.[0], e.target));

// Glisser-déposer une image : dans la fenêtre d'ajout, ou n'importe où sur la page (la fenêtre s'ouvre)
const avecFichiers = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");
document.addEventListener("dragover", (e) => {
  if (!avecFichiers(e)) return;
  e.preventDefault(); e.dataTransfer.dropEffect = "copy";
  $("#zone-depot").classList.add("survol");
});
document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) $("#zone-depot").classList.remove("survol"); });
document.addEventListener("drop", async (e) => {
  if (!avecFichiers(e)) return;
  e.preventDefault();
  $("#zone-depot").classList.remove("survol");
  const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
  if (!$("#ajout").open) { if (!f) return; $("#bouton-ajouter").click(); await new Promise((r) => setTimeout(r, 50)); }
  if (!f) { $("#scan-statut").textContent = "Ce fichier n'est pas une image. Glisse une photo de la carte (JPG, PNG, HEIC…)."; return; }
  scannerPhoto(f);
});

// Webcam (si disponible), avec un repli propre si elle est refusée ou absente
let fluxWebcam = null;
const webcamPossible = () => !!navigator.mediaDevices?.getUserMedia;
$("#bouton-webcam").hidden = !webcamPossible();
function arreterWebcam() {
  fluxWebcam?.getTracks().forEach((t) => t.stop());
  fluxWebcam = null;
  $("#webcam-video").srcObject = null;
  $("#webcam").hidden = true;
  $("#bouton-webcam").hidden = !webcamPossible();
}
$("#bouton-webcam").addEventListener("click", async () => {
  const statut = $("#scan-statut");
  try {
    fluxWebcam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false });
    const v = $("#webcam-video");
    v.srcObject = fluxWebcam;
    $("#webcam").hidden = false; $("#bouton-webcam").hidden = true;
    await v.play().catch(() => {});
    statut.textContent = "Tiens la carte bien à plat devant la webcam, puis prends la photo.";
    $("#webcam-photo").focus();
  } catch (err) {
    arreterWebcam();
    statut.textContent = err?.name === "NotAllowedError" || err?.name === "SecurityError"
      ? "Webcam refusée. Pas de souci : glisse une photo de la carte ici, ou choisis un fichier."
      : "Aucune webcam disponible. Glisse une photo de la carte ici, ou choisis un fichier.";
  }
});
$("#webcam-photo").addEventListener("click", async () => {
  const v = $("#webcam-video");
  if (!v.videoWidth) { $("#scan-statut").textContent = "La webcam démarre encore, réessaie dans une seconde."; return; }
  const c = document.createElement("canvas");
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.92));
  arreterWebcam();
  if (blob) scannerPhoto(new File([blob], "webcam.jpg", { type: "image/jpeg" }));
});
$("#webcam-annuler").addEventListener("click", () => { arreterWebcam(); $("#scan-statut").textContent = ""; });
$("#ajout").addEventListener("close", arreterWebcam);

/* ================= Mode sombre ================= */
const sombreSysteme = matchMedia("(prefers-color-scheme: dark)");
const themeActuel = () => document.documentElement.dataset.theme || (sombreSysteme.matches ? "sombre" : "clair");
function majTheme() {
  const sombre = themeActuel() === "sombre";
  $("#bouton-theme").setAttribute("aria-label", sombre ? "Passer en mode clair" : "Passer en mode sombre");
  document.documentElement.classList.toggle("est-sombre", sombre);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", sombre ? "#121212" : "#F6F6F4");
}
$("#bouton-theme").addEventListener("click", () => {
  const t = themeActuel() === "sombre" ? "clair" : "sombre";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("theme", t); } catch {}
  majTheme();
});
sombreSysteme.addEventListener?.("change", majTheme);
majTheme();

/* ================= Installation (PWA) ================= */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
