/* PokeVibes — Fiche d'une carte, qu'on la possède ou non (ma collection, la vitrine d'un membre, le Classeur,
   la recherche, la Wishlist) : grande image, prix Cardmarket FR, Favori / Alerte / Retirer, gain-perte, min, max,
   et l'historique des prix sur 7 j / 30 j / 90 j / tout.
   Fenêtre sur iPhone, fenêtre centrée sur tablette et petit PC, panneau à droite de la liste dès 1200 px. */
import { $, esc, euro, GRAND_ECRAN, pct, dateLongue } from "./commun.js?v=15";
import { etat, sb } from "./etat.js?v=15";
import { etiquetteTendance, graphique } from "./prix.js?v=15";
import { PERIODES, historiqueValide, pointsSurPeriode, periodeParDefaut, extremes, gainPerte, alertesDeLaCarte } from "./suivi.js?v=15";
import { entreeFiche, animer, dessinerCourbe } from "./animations.js?v=15";
import { chargerCollection } from "./collection.js?v=15";
import { depuisProduit, completerCarte, possession } from "./cartes.js?v=15";
import { estFavori, basculerFavori } from "./wishlist.js?v=15";
import { ouvrirAlerte, htmlAlertes, actionAlerte } from "./alertes.js?v=15";
import { message } from "./badges-ui.js?v=15";

let carte = null, points = [], periode = "30", tourFiche = 0;
const SOURCES = { airtable: "relevé Airtable", api_fr: "Cardmarket FR (automatique)", manuel: "saisie manuelle", catalogue: "Cardmarket FR (relevé de l'extension)", collection: "Cardmarket FR (automatique)" };
const ICONES = {
  etoile: `<svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>`,
  cloche: `<svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0" fill="none"/></svg>`,
  retirer: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>`,
};
const jourCourt = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

// Ouvre la fiche d'une carte (objet de cartes.js) ou d'une ligne de ma collection / de la vitrine
export async function ouvrirFiche(source) {
  const tour = ++tourFiche;
  const c = source.produit_id !== undefined && "prix" in source ? source : depuisProduit(source);
  await completerCarte(c);
  let releves = [];
  if (c.produit_id != null) {
    const { data } = await sb.from("prix").select("le, prix, source, valide").eq("produit_id", c.produit_id).eq("etat_prix", c.defaut ? "defaut" : "standard").order("le");
    releves = data ?? [];
  }
  if (tour !== tourFiche) return; // une autre carte a été touchée entre-temps
  carte = c;
  points = historiqueValide(releves.filter((r) => r.valide));
  if (c.prix == null && points.length) Object.assign(c, { prix: points.at(-1).prix, prix_le: points.at(-1).le });
  periode = periodeParDefaut(points);
  const suspect = releves.filter((r) => !r.valide).at(-1);
  const pos = possession(c);
  $("#fiche-contenu").innerHTML = `
    <div class="fiche-tete">
      <span class="visuel fiche-visuel ${c.categorie === "scelle" ? "scelle" : ""}">${c.image ? `<img src="${esc(c.image)}" alt="">` : `<span class="sans-image">${esc(c.type_scelle ?? c.rarete ?? "Carte")}</span>`}</span>
      <h2>${esc(c.nom)}</h2>
      <p class="fiche-ref">${esc([c.extension, c.numero, c.rarete].filter(Boolean).join(" · "))}</p>
      ${c.defaut ? `<p class="defaut">Exemplaire avec défaut</p>` : ""}
    </div>
    <div class="fiche-prix">
      <p class="fiche-prix-libelle">Prix Cardmarket FR${c.prix_le ? ` · relevé du ${jourCourt(c.prix_le)}` : ""}</p>
      <p class="fiche-prix-valeur">${c.prix == null ? `? <span class="infos">attendu au prochain relevé</span>` : euro(c.prix)}</p>
      ${c.tendance != null ? `<p class="fiche-tendance">${etiquetteTendance(c.tendance)}</p>` : ""}
      ${pos ? `<ul class="fiche-achats">${pos.achats.slice(0, 4).map((a) => `<li>${a.le ? `Acheté le ${dateLongue(a.le)}` : "Acheté"} : <strong>${a.prix == null ? "prix non noté" : euro(a.prix)}</strong>${a.quantite > 1 ? ` <span class="infos">× ${a.quantite}</span>` : ""}</li>`).join("")}${pos.achats.length > 4 ? `<li class="infos">et ${pos.achats.length - 4} autre${pos.achats.length > 5 ? "s" : ""} achat${pos.achats.length > 5 ? "s" : ""}</li>` : ""}</ul>` : ""}
    </div>
    <div class="fiche-actions">
      <button type="button" class="action" id="fiche-favori" aria-pressed="false">${ICONES.etoile}<span>Favori</span></button>
      <button type="button" class="action" id="fiche-alerte" aria-pressed="false">${ICONES.cloche}<span>Alerte</span></button>
      ${pos ? `<button type="button" class="action action-retirer" id="fiche-retirer">${ICONES.retirer}<span>Retirer</span></button>` : ""}
    </div>
    <div class="fiche-retrait" id="fiche-retrait" hidden role="group" aria-labelledby="retrait-texte">
      <p id="retrait-texte">Retirer ${pos?.quantite > 1 ? `les ${pos.quantite} exemplaires` : "cette carte"} de ta collection ?</p>
      <div><button type="button" class="mini mini-danger" id="retrait-oui">Oui, retirer</button><button type="button" class="mini" id="retrait-non">Annuler</button></div>
    </div>
    <div class="fiche-alertes" id="fiche-alertes"></div>
    ${htmlCases(c, pos)}
    <section class="fiche-graphe" aria-labelledby="graphe-titre">
      <div class="graphe-entete">
        <h3 id="graphe-titre">Historique du prix</h3>
        ${points.length >= 2 ? `<div class="puces periodes" id="periodes" role="group" aria-label="Période">${PERIODES.map((p) => {
          const n = pointsSurPeriode(points, p.jours).length;
          return `<button type="button" data-val="${p.id}" aria-pressed="${p.id === periode}"${n < 2 ? ` disabled title="Pas encore assez de relevés sur ${p.nom}"` : ""}>${p.nom}</button>`;
        }).join("")}</div>` : ""}
      </div>
      <div id="graphe" class="graphe">${htmlGraphe()}</div>
    </section>
    <dl class="fiche-details">
      ${pos ? `<dt>Quantité</dt><dd><span class="stepper"><button data-delta="-1" aria-label="Retirer un exemplaire">−</button><span id="fiche-qte">${pos.quantite}</span><button data-delta="1" aria-label="Ajouter un exemplaire">+</button></span></dd>
        <dt>Valeur</dt><dd>${euro(pos.item.valeur)}</dd>` : ""}
      ${pos && pos.prix_achat == null && c.categorie === "carte" ? `<dt>Origine</dt><dd>Tirée d'un booster</dd>` : ""}
      <dt>Source du prix</dt><dd>${esc(SOURCES[c.prix_source] ?? c.prix_source ?? "—")}</dd>
    </dl>
    ${suspect ? `<p class="alerte">Prix en attente de confirmation : ${euro(suspect.prix)} le ${new Date(suspect.le).toLocaleDateString("fr-FR")}. Il sera pris en compte s'il se confirme au prochain relevé.</p>` : ""}
    ${c.lien_cardmarket ? `<p><a href="${esc(c.lien_cardmarket)}" target="_blank" rel="noopener">Voir les offres FR sur Cardmarket</a></p>` : ""}
    ${pos ? `<details class="prix-manuel"><summary>Saisir un prix moi-même</summary>
      <div class="ligne-recherche"><input id="prix-manuel" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Prix unitaire en €"><button id="valider-prix" type="button">Enregistrer</button></div>
      <p class="aide">Utile pour les produits que le relevé automatique ne suit pas (boosters à l'unité, coffrets, One Piece).</p></details>` : ""}
    <p id="fiche-message" class="message" role="status"></p>`;
  majSuivi();
  ouvrirFenetreFiche();
  entreeFiche();
  brancher(c, pos);
}

// Les 3 cases : gain / perte (si on possède la carte avec un prix d'achat), prix min, prix max
function htmlCases(c, pos) {
  const gp = pos?.prix_achat != null ? gainPerte(c.prix, pos.prix_achat) : null;
  const total = gp && pos.benefice != null ? { ecart: pos.benefice, pct: pos.evolution_pct ?? gp.pct } : gp;
  const { min, max } = extremes(points);
  const vide = (texte) => `<strong>—</strong><small>${texte}</small>`;
  return `<div class="fiche-cases">
    <div class="case ${gp ? gp.sens : ""}"><p>Gain / perte</p>${gp ? `<strong>${total.ecart > 0 ? "+" : ""}${euro(total.ecart)}</strong><small>${pct(total.pct)}${pos.quantite > 1 ? ` · ${pos.quantite} ex.` : ""}</small>` : vide(pos ? "pas de prix d'achat" : "carte non possédée")}</div>
    <div class="case"><p>Prix min</p>${min ? `<strong>${euro(min.prix)}</strong><small>le ${jourCourt(min.le)}</small>` : vide("pas encore d'historique")}</div>
    <div class="case"><p>Prix max</p>${max ? `<strong>${euro(max.prix)}</strong><small>le ${jourCourt(max.le)}</small>` : vide("pas encore d'historique")}</div>
  </div>`;
}

function htmlGraphe() {
  if (points.length < 2) return `<p class="graphe-vide">L'historique se remplit chaque jour depuis le 9 novembre.${points.length === 1 ? ` Premier relevé : ${euro(points[0].prix)} le ${jourCourt(points[0].le)}.` : ""}</p>`;
  const p = PERIODES.find((x) => x.id === periode);
  return graphique(pointsSurPeriode(points, p.jours), { titre: p.jours ? `sur ${p.jours} jours` : "depuis le premier relevé" });
}

// Favori, alertes : état des boutons et liste des alertes (redessinés à chaque changement, sans animation)
function majSuivi() {
  if (!carte || !$("#fiche-favori")) return;
  const fav = estFavori(carte), alertes = alertesDeLaCarte(etat.alertes, carte), active = alertes.some((a) => a.active);
  const f = $("#fiche-favori"), a = $("#fiche-alerte");
  f.setAttribute("aria-pressed", String(fav)); f.querySelector("span").textContent = fav ? "Dans ta Wishlist" : "Favori";
  f.setAttribute("aria-label", fav ? "Retirer de la Wishlist" : "Ajouter à la Wishlist");
  a.setAttribute("aria-pressed", String(active)); a.querySelector("span").textContent = active ? "Alerte active" : "Alerte";
  a.setAttribute("aria-label", active ? "Créer une autre alerte de prix (une alerte est déjà active)" : "Créer une alerte de prix");
  $("#fiche-alertes").innerHTML = htmlAlertes(carte);
}

function brancher(c, pos) {
  const msg = (t) => { $("#fiche-message").textContent = t; };
  $("#fiche-favori").addEventListener("click", async () => {
    const r = await basculerFavori(c); msg(r.message);
    if (r.ok && estFavori(c)) animer($("#fiche-favori svg"), "embleme", 0);
  });
  $("#fiche-alerte").addEventListener("click", () => ouvrirAlerte(c));
  $("#fiche-alertes").addEventListener("click", (e) => actionAlerte(e, c));
  $("#periodes")?.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    periode = b.dataset.val;
    $("#periodes").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#graphe").innerHTML = htmlGraphe();
    animer($("#graphe .graphe-aire"), "bloc", 0);
    dessinerCourbe($("#graphe svg"), 0);
  });
  if (!pos) return;
  const retrait = $("#fiche-retrait");
  const demanderRetrait = () => { retrait.hidden = false; animer(retrait, "bouton", 0); $("#retrait-non").focus(); };
  $("#fiche-retirer").addEventListener("click", demanderRetrait);
  $("#retrait-non").addEventListener("click", () => { retrait.hidden = true; $("#fiche-retirer").focus(); });
  $("#retrait-oui").addEventListener("click", async () => {
    $("#retrait-oui").disabled = true;
    const { error } = await sb.rpc("modifier_quantite", { p_produit_id: c.produit_id, p_defaut: c.defaut, p_delta: -pos.quantite });
    if (error) { $("#retrait-oui").disabled = false; msg(`Retrait impossible : ${error.message}`); return; }
    $("#fiche").close();
    message(`« ${c.nom} » est retirée de ta collection.`);
    await chargerCollection();
  });
  $("#fiche-contenu").querySelectorAll("[data-delta]").forEach((b) => b.addEventListener("click", async () => {
    const delta = Number(b.dataset.delta);
    if (delta < 0 && pos.quantite === 1) return demanderRetrait();
    const { data: reste, error } = await sb.rpc("modifier_quantite", { p_produit_id: c.produit_id, p_defaut: c.defaut, p_delta: delta });
    if (error) { msg(`Modification impossible : ${error.message}`); return; }
    pos.quantite = reste;
    $("#fiche-qte").textContent = reste;
    await chargerCollection();
  }));
  $("#valider-prix")?.addEventListener("click", async () => {
    const v = Number($("#prix-manuel").value);
    if (!(v >= 0) || $("#prix-manuel").value === "") { msg("Indique un prix en euros, par exemple 12,50."); return; }
    const { error } = await sb.rpc("saisir_prix", { p_produit_id: c.produit_id, p_prix: v, p_defaut: c.defaut });
    msg(error ? `Prix non enregistré : ${error.message}` : `Prix enregistré : ${euro(v)}.`);
    if (!error) chargerCollection();
  });
}

// Fiche : panneau à droite de la liste (≥ 1200 px, la liste reste utilisable), sinon fenêtre comme avant
export function ouvrirFenetreFiche() {
  const f = $("#fiche"), panneau = GRAND_ECRAN.matches;
  if (f.open && f.classList.contains("panneau") === panneau) return; // déjà ouverte : le contenu vient d'être remplacé
  if (f.open) f.close();
  f.classList.toggle("panneau", panneau);
  document.body.classList.toggle("avec-panneau", panneau);
  if (panneau) f.show(); else f.showModal();
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initFiche() {
  // Une pochette (ma collection ou la vitrine d'un membre) ouvre sa fiche
  document.addEventListener("click", async (e) => {
    const p = e.target.closest(".pochette"); if (!p) return;
    const id = Number(p.dataset.id), defaut = p.dataset.defaut === "true";
    const x = (p.closest("#classeur") ? etat.toutes : etat.vitrine).find((y) => y.produit_id === id && y.defaut === defaut);
    if (x) ouvrirFiche(x);
  });
  $("#fiche").addEventListener("close", () => { document.body.classList.remove("avec-panneau"); carte = null; });
  GRAND_ECRAN.addEventListener?.("change", () => { if ($("#fiche").open && $("#fiche").classList.contains("panneau")) $("#fiche").close(); });
  document.addEventListener("suivi", majSuivi);
}
