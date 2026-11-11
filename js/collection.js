/* PokeVibes — Collection : chargement, couverture (valeur, plus-value), filtres et pochettes. */
import { $, calme, esc, euro, NOM_JEU, pct } from "./commun.js?v=15";
import { etat, sb } from "./etat.js?v=15";
import { etiquetteTendance, fusionner, parPrix, tendanceDepuisDetail, tendanceMoyenne, totaux } from "./prix.js?v=15";
import { aAnimer, courbeEZ, entreeCartes, restant, rythme } from "./animations.js?v=15";
import { verifierBadges } from "./badges-ui.js?v=15";

/* ================= Données ================= */
export async function chargerCollection() {
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
export async function chargerTendances(liste) {
  const ids = [...new Set(liste.map((x) => x.produit_id))];
  if (!ids.length) return;
  const { data } = await sb.from("prix_actuel").select("produit_id, etat_prix, source, detail").in("produit_id", ids).eq("source", "api_fr");
  const m = new Map((data ?? []).map((r) => [`${r.produit_id}|${r.etat_prix}`, r.detail]));
  for (const x of liste) {
    const d = m.get(`${x.produit_id}|${x.defaut ? "defaut" : "standard"}`);
    x.tendance = tendanceDepuisDetail(d);
  }
}

export const duJeu = () => etat.toutes.filter((x) => x.jeu === etat.jeu);

export function dessinerCollection() {
  $("#titre-collection").textContent = `Collection ${NOM_JEU[etat.jeu]}`;
  resume();
  dessinerClasseur();
}

export function resume() {
  const c = duJeu(), t = totaux(c);
  compteur($("#total-valeur"), t.valeur);
  $("#total-scelle").innerHTML = `${euro(t.scelle.valeur, 0)} <small>(${t.scelle.nombre})</small>`;
  $("#total-cartes").innerHTML = `${euro(t.cartes.valeur, 0)} <small>(${t.cartes.nombre})</small>`;
  $("#total-achat").textContent = euro(t.achat, 0);
  const g = $("#total-gain");
  g.innerHTML = `<span class="pastille">${pct(t.gainPct)}</span> ${t.gain >= 0 ? "+" : ""}${euro(t.gain, 0)} de plus-value`;
  g.className = t.gain >= 0 ? "positif" : "negatif";
  requestAnimationFrame(() => { $("#jauge-achat").style.width = `${t.partAchat}%`; });
  $("#maj-prix").textContent = (t.dernierReleve ? `Dernier relevé de prix le ${new Date(t.dernierReleve).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.` : "")
    + (t.enAttente ? ` ${t.enAttente} objet${t.enAttente > 1 ? "s" : ""} en attente de prix.` : "");
  const tg = tendanceMoyenne(c);
  $("#tendance-globale").innerHTML = tg == null ? "" : `Marché sur 30 jours : ${etiquetteTendance(tg)}`;
}

// La valeur compte de 0 à sa valeur à l'entrée (au moment où la couverture arrive),
// puis d'une valeur à l'autre lors des mises à jour. Mouvement réduit : affichée directement.
export let tourCompteur = 0;

export function compteur(el, cible) {
  const entree = aAnimer.delete("valeur");
  const depart = entree ? 0 : (el._valeur ?? 0);
  el._valeur = cible;
  const tour = ++tourCompteur;
  if (calme || depart === cible) { el.textContent = euro(cible, 0); return; }
  el.textContent = euro(depart, 0);
  const t0 = performance.now() + (entree ? restant(rythme.tCouverture) : 0), duree = 1200;
  const pas = (t) => {
    if (tour !== tourCompteur) return;
    const k = Math.min(1, Math.max(0, (t - t0) / duree));
    el.textContent = euro(depart + (cible - depart) * courbeEZ(k), 0);
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

/* ================= Classeur ================= */
export function filtrer(liste) {
  const q = etat.recherche.toLowerCase();
  return liste.filter((x) => (!etat.categorie || x.categorie === etat.categorie) &&
    (!q || `${x.nom} ${x.numero ?? ""} ${x.extension ?? ""} ${x.rarete ?? ""} ${x.type_scelle ?? ""}`.toLowerCase().includes(q)));
}

export function pochette(x, avecAchat = true) {
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

export function sousSections(items, avecAchat) {
  const sc = items.filter((x) => x.categorie === "scelle").sort(parPrix);
  const ca = items.filter((x) => x.categorie === "carte").sort(parPrix);
  const bloc = (titre, l) => l.length ? `<div class="sous-page"><h4>${titre} <span>${l.reduce((s, x) => s + x.quantite, 0)}</span></h4>
    <div class="pochettes">${l.map((x) => pochette(x, avecAchat)).join("")}</div></div>` : "";
  return bloc("Scellé", sc) + bloc("Cartes", ca);
}

export function grouper(liste, avecAchat) {
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

export function dessinerClasseur() {
  const liste = filtrer(duJeu());
  $("#classeur").innerHTML = liste.length ? grouper(liste, true)
    : duJeu().length ? `<p class="vide">Rien ne correspond à ces filtres. Essaie « Scellé et cartes » ou une autre recherche.</p>`
    : `<p class="vide">Ta collection ${NOM_JEU[etat.jeu]} est vide. Appuie sur « + Ajouter » pour commencer.</p>`;
  if (aAnimer.delete("collection")) entreeCartes($("#classeur"), rythme.tCartes);
}

export function marquerJeu(jeu) {
  document.querySelectorAll(".jeu-choix").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.jeu === jeu)));
}

export function basculerJeu(jeu) {
  etat.jeu = jeu;
  marquerJeu(jeu);
  $("#ajout-titre").textContent = `Ajouter à la collection ${NOM_JEU[jeu]}`;
  dessinerCollection();
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initCollection() {
  document.querySelectorAll(".filtres .puces").forEach((g) => g.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    etat[g.dataset.filtre] = b.dataset.val;
    dessinerClasseur();
  }));
  $("#recherche").addEventListener("input", (e) => { etat.recherche = e.target.value; dessinerClasseur(); });
  $("#tri").addEventListener("change", (e) => { etat.tri = e.target.value; dessinerClasseur(); });
  document.querySelectorAll(".jeu-choix").forEach((o) => o.addEventListener("click", () => {
    etat.jeu = o.dataset.jeu; marquerJeu(etat.jeu);
    rythme.debut = performance.now(); rythme.tCouverture = 0; rythme.tCartes = 150; aAnimer.add("valeur").add("collection");
    dessinerCollection();
  }));
}
