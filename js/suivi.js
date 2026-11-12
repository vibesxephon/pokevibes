/* PokeVibes — Wishlist, alertes de prix et historique (calculs purs, testés dans tests/suivi.test.js).
   Une carte est repérée par son produit (produit_id, si quelqu'un de L'Équipage l'a déjà ajoutée)
   et / ou par son identifiant du catalogue TCGdex (tcgdex_id, ex. « swsh7-215 »). */
import { euro, dateLongue } from "./format.js?v=17";

// Deux références désignent-elles la même carte ? (favori, alerte ou carte de la fiche)
export function memeCarte(a, b) {
  if (!a || !b) return false;
  return (a.produit_id != null && a.produit_id === b.produit_id) || (a.tcgdex_id != null && a.tcgdex_id === b.tcgdex_id);
}

/* ---------- Historique des prix ---------- */
export const PERIODES = [{ id: "7", jours: 7, nom: "7 j" }, { id: "30", jours: 30, nom: "30 j" }, { id: "90", jours: 90, nom: "90 j" }, { id: "tout", jours: null, nom: "Tout" }];

// Relevés valides seulement, du plus ancien au plus récent, un seul par jour (le dernier)
export function historiqueValide(releves) {
  const parJour = new Map();
  for (const r of releves ?? []) if (r.valide !== false && Number(r.prix) >= 0 && r.le) parJour.set(String(r.le).slice(0, 10), Number(r.prix));
  return [...parJour.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([le, prix]) => ({ le, prix }));
}

// Relevés des n derniers jours (jour compris), ou tous
export function pointsSurPeriode(points, jours, maintenant = Date.now()) {
  if (!jours) return points;
  const debut = new Date(maintenant - (jours - 1) * 864e5).toISOString().slice(0, 10);
  return points.filter((p) => p.le >= debut);
}

// Période affichée par défaut : 30 jours s'il y a de quoi tracer une courbe, sinon tout l'historique
export function periodeParDefaut(points, maintenant = Date.now()) {
  return pointsSurPeriode(points, 30, maintenant).length >= 2 ? "30" : "tout";
}

// Prix min / max sur tout l'historique disponible (avec leur date)
export function extremes(points) {
  if (!points.length) return { min: null, max: null };
  let min = points[0], max = points[0];
  for (const p of points) { if (p.prix < min.prix) min = p; if (p.prix > max.prix) max = p; }
  return { min, max };
}

// Gain / perte d'un exemplaire possédé : valeur actuelle comparée au prix payé
export function gainPerte(prixActuel, prixAchat) {
  if (prixActuel == null || !(Number(prixAchat) > 0)) return null;
  const ecart = Number(prixActuel) - Number(prixAchat);
  return { ecart, pct: (ecart / Number(prixAchat)) * 100, sens: ecart > 0 ? "gain" : ecart < 0 ? "perte" : "egal" };
}

/* ---------- Alertes ---------- */
// Seuil proposé : 10 % sous le prix actuel (ou au-dessus pour une alerte « au-dessus »), arrondi au centime
export function seuilPropose(prix, sens = "dessous") {
  if (!(Number(prix) > 0)) return null;
  return Math.max(0.01, Math.round(Number(prix) * (sens === "dessus" ? 1.1 : 0.9) * 100) / 100);
}

export const alertesDeLaCarte = (alertes, carte) => (alertes ?? []).filter((a) => memeCarte(a, carte));

// Texte de l'état d'une alerte : « En dessous de 18,00 € · active » / « … · déclenchée le 12 novembre 2026 à 17,50 € »
export function libelleAlerte(a) {
  const quand = `${a.sens === "dessus" ? "Au-dessus de" : "En dessous de"} ${euro(a.seuil)}`;
  if (a.active) return { quand, etat: "Active", declenchee: false };
  if (a.declenchee_le) return { quand, etat: `Déclenchée le ${dateLongue(a.declenchee_le)}${a.prix_declenchement != null ? ` à ${euro(a.prix_declenchement)}` : ""}`, declenchee: true };
  return { quand, etat: "En pause", declenchee: false };
}

// Prévenir si l'alerte se déclencherait tout de suite (le prix est déjà de l'autre côté du seuil)
export function dejaFranchi(sens, seuil, prix) {
  if (prix == null || !(seuil > 0)) return false;
  return sens === "dessus" ? Number(prix) >= seuil : Number(prix) <= seuil;
}

/* ---------- Wishlist ---------- */
// Tri : prix (le plus cher d'abord), tendance (la plus forte hausse d'abord), ajout (le plus récent d'abord) ; inconnus à la fin
export function trierWishlist(cartes, cle = "ajout") {
  const l = [...cartes];
  const val = { prix: (c) => c.prix, tendance: (c) => c.tendance, ajout: (c) => (c.ajoute_le ? new Date(c.ajoute_le).getTime() : null) }[cle] ?? ((c) => c.ajoute_le);
  return l.sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return y - x;
  });
}

/* ---------- Badge « Bonne affaire » ----------
   Une alerte « en dessous » déclenchée sur une carte qu'on a achetée ensuite
   (exemplaire acheté le jour du déclenchement ou après). produitDe : Map tcgdex_id → produit_id. */
export function bonneAffaire(alertes, lignes, produitDe = new Map()) {
  for (const a of alertes ?? []) {
    if (a.sens !== "dessous" || !a.declenchee_le) continue;
    const produit = a.produit_id ?? produitDe.get(a.tcgdex_id);
    if (produit == null) continue;
    const jour = new Date(a.declenchee_le).toLocaleDateString("fr-CA");
    if ((lignes ?? []).some((l) => l.produit_id === produit && l.achete_le && String(l.achete_le).slice(0, 10) >= jour)) return true;
  }
  return false;
}
