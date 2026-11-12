/* PokeVibes — Wishlist : les cartes guettées (étoile de la fiche), avec leur prix, leur tendance et les alertes.
   Les favoris et les alertes du membre sont chargés une fois puis tenus à jour ici ; toute modification
   envoie l'événement « suivi » pour que la fiche et la Wishlist se redessinent. */
import { $, esc, euro } from "./commun.js?v=17";
import { etat, sb } from "./etat.js?v=17";
import { etiquetteTendance } from "./prix.js?v=17";
import { memeCarte, trierWishlist, alertesDeLaCarte } from "./suivi.js?v=17";
import { aAnimer, animerListe } from "./animations.js?v=17";
import { cartesDesFavoris, possession } from "./cartes.js?v=17";
import { verifierBadges } from "./badges-ui.js?v=17";
import { ouvrirFiche } from "./fiche.js?v=17";

export const signalerSuivi = () => document.dispatchEvent(new CustomEvent("suivi"));

export async function chargerSuivi() {
  try {
    const id = etat.moi?.id; if (!id) return;
    const [f, a] = await Promise.all([
      sb.from("favoris").select("id, produit_id, tcgdex_id, ajoute_le").eq("membre_id", id).order("ajoute_le", { ascending: false }),
      sb.from("alertes").select("id, produit_id, tcgdex_id, sens, seuil, active, declenchee_le, prix_declenchement, cree_le").eq("membre_id", id).order("cree_le"),
    ]);
    if (!f.error) etat.favoris = f.data ?? [];
    if (!a.error) etat.alertes = (a.data ?? []).map((x) => ({ ...x, seuil: Number(x.seuil) }));
    etat.suiviPret = !f.error && !a.error;
  } catch (e) { console.warn("Wishlist indisponible pour l'instant :", e?.message ?? e); }
}

export const estFavori = (c) => (etat.favoris ?? []).some((f) => memeCarte(f, c));

// Ajoute ou retire la carte de la Wishlist (affichage immédiat, annulé si la base refuse)
export async function basculerFavori(c) {
  const existant = etat.favoris.find((f) => memeCarte(f, c));
  if (existant) {
    etat.favoris = etat.favoris.filter((f) => f !== existant); signalerSuivi();
    const { error } = await sb.from("favoris").delete().eq("id", existant.id);
    if (error) { etat.favoris.push(existant); signalerSuivi(); return { ok: false, message: `Pas retirée de la Wishlist : ${error.message}` }; }
    return { ok: true, message: "Retirée de ta Wishlist." };
  }
  const provisoire = { id: null, produit_id: c.produit_id ?? null, tcgdex_id: c.tcgdex_id ?? null, ajoute_le: new Date().toISOString() };
  etat.favoris.unshift(provisoire); signalerSuivi();
  const { data, error } = await sb.from("favoris").insert({ membre_id: etat.moi.id, produit_id: provisoire.produit_id, tcgdex_id: provisoire.tcgdex_id })
    .select("id, produit_id, tcgdex_id, ajoute_le").single();
  if (error) { etat.favoris = etat.favoris.filter((f) => f !== provisoire); signalerSuivi(); return { ok: false, message: `Pas ajoutée à la Wishlist : ${error.message}` }; }
  Object.assign(provisoire, data ?? {});
  verifierBadges();
  return { ok: true, message: "Ajoutée à ta Wishlist." };
}

// Produits liés aux alertes déclenchées sur des cartes du catalogue (pour le badge « Bonne affaire »)
export async function produitsDesAlertes() {
  const ids = [...new Set((etat.alertes ?? []).filter((a) => a.declenchee_le && a.produit_id == null && a.tcgdex_id).map((a) => a.tcgdex_id))];
  const m = new Map();
  if (!ids.length) return m;
  const { data } = await sb.from("produits").select("id, tcgdex_id").in("tcgdex_id", ids);
  for (const p of data ?? []) m.set(p.tcgdex_id, p.id);
  return m;
}

/* ---------- La vue Wishlist ---------- */
let cartesAffichees = [], tourWishlist = 0;
export async function dessinerWishlist() {
  const tour = ++tourWishlist;
  const liste = $("#wishlist");
  if (!etat.favoris?.length) {
    cartesAffichees = [];
    $("#wishlist-barre").hidden = true;
    liste.innerHTML = `<li class="vide wishlist-vide">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>
      <strong>Ta Wishlist est vide</strong>
      Ouvre la fiche d'une carte (dans ta collection, le Classeur en mode « Voir la fiche », ou chez un membre de L'Équipage) et touche l'étoile « Favori » : elle arrive ici, avec son prix et sa tendance.</li>`;
    if (aAnimer.delete("wishlist")) animerListe(liste.children, 300, 120, "bloc");
    return;
  }
  if (!cartesAffichees.length) liste.innerHTML = `<li class="vide">Chargement de ta Wishlist…</li>`;
  let cartes;
  try { cartes = await cartesDesFavoris(etat.favoris); }
  catch { if (tour === tourWishlist) liste.innerHTML = `<li class="vide">La Wishlist n'a pas pu être chargée. Réessaie dans un instant.</li>`; return; }
  if (tour !== tourWishlist) return;
  cartesAffichees = trierWishlist(cartes, $("#wishlist-tri").value);
  const actives = (etat.alertes ?? []).filter((a) => a.active && cartesAffichees.some((c) => memeCarte(a, c))).length;
  $("#wishlist-barre").hidden = false;
  $("#wishlist-compte").textContent = `${cartesAffichees.length} carte${cartesAffichees.length > 1 ? "s" : ""}${actives ? ` · ${actives} alerte${actives > 1 ? "s" : ""} active${actives > 1 ? "s" : ""}` : ""}`;
  liste.innerHTML = cartesAffichees.map((c, i) => {
    const alertes = alertesDeLaCarte(etat.alertes, c), active = alertes.find((a) => a.active);
    const declenchee = !active && alertes.find((a) => a.declenchee_le);
    const alerte = active ? `<span class="voeu-alerte active">${ICONE_CLOCHE}${active.sens === "dessus" ? "Au-dessus de" : "En dessous de"} ${euro(active.seuil)}</span>`
      : declenchee ? `<span class="voeu-alerte declenchee">${ICONE_CLOCHE}Alerte déclenchée</span>` : `<span class="voeu-alerte">${ICONE_CLOCHE}Pas d'alerte</span>`;
    const img = c.image ? `<img src="${esc(c.image.replace(/\/high\.webp$/, "/low.webp"))}" alt="" loading="lazy">` : `<span class="sans-image">${esc(c.type_scelle ?? c.rarete ?? "Carte")}</span>`;
    return `<li><button type="button" class="voeu" data-i="${i}">
      <span class="visuel voeu-img" aria-hidden="true">${img}</span>
      <span class="voeu-texte">
        <span class="nom">${esc(c.nom)}</span>
        <span class="infos">${esc([c.extension, c.numero].filter(Boolean).join(" · "))}</span>
        <span class="voeu-prix"><strong>${c.prix == null ? `<span class="inconnu" title="Prix attendu au prochain relevé">?</span>` : euro(c.prix)}</strong>${etiquetteTendance(c.tendance, true)}</span>
        ${alerte}
        ${possession(c) ? `<span class="voeu-possedee">Dans ta collection</span>` : ""}
      </span></button></li>`;
  }).join("");
  if (aAnimer.delete("wishlist")) animerListe(liste.children, 300, 120, "carte");
}
const ICONE_CLOCHE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>`;

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initWishlist() {
  etat.favoris = []; etat.alertes = [];
  $("#wishlist-tri").addEventListener("change", () => dessinerWishlist());
  $("#wishlist").addEventListener("click", (e) => {
    const b = e.target.closest(".voeu"); if (!b) return;
    const c = cartesAffichees[Number(b.dataset.i)];
    if (c) ouvrirFiche({ ...c });
  });
  document.addEventListener("suivi", () => { if (!$("#vue-wishlist").hidden) dessinerWishlist(); });
}
