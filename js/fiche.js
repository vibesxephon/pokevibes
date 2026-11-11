/* PokeVibes — Fiche détaillée d'une carte (fenêtre, ou panneau à droite sur grand écran). */
import { $, esc, euro, GRAND_ECRAN, pct } from "./commun.js?v=14";
import { etat, sb } from "./etat.js?v=14";
import { courbe, etiquetteTendance } from "./prix.js?v=14";
import { entreeFiche } from "./animations.js?v=14";
import { chargerCollection } from "./collection.js?v=14";

export async function ouvrirFiche(x, mien) {
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
  /* ================= Fiche ================= */
  document.addEventListener("click", async (e) => {
    const p = e.target.closest(".pochette"); if (!p) return;
    const id = Number(p.dataset.id), defaut = p.dataset.defaut === "true";
    const mien = !!p.closest("#classeur");
    const x = (mien ? etat.toutes : etat.vitrine).find((y) => y.produit_id === id && y.defaut === defaut);
    if (x) ouvrirFiche(x, mien);
  });
  $("#fiche").addEventListener("close", () => document.body.classList.remove("avec-panneau"));
  GRAND_ECRAN.addEventListener?.("change", () => { if ($("#fiche").open && $("#fiche").classList.contains("panneau")) $("#fiche").close(); });
}
