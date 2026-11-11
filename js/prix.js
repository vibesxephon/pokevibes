/* PokeVibes — prix, valeur, plus-value et tendance 30 jours (calculs purs, testés dans tests/prix.test.js). */
import { euro } from "./format.js?v=14";

// Un même produit acheté à des prix différents (ex. 3 ETB 30 Ans) = une seule pochette
export function fusionner(lignes) {
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

// Totaux de la couverture : valeur, prix payé, plus-value (seulement sur ce qui a un prix d'achat ET un prix actuel)
export function totaux(liste) {
  const somme = (l, f) => l.reduce((s, x) => s + Number(f(x) ?? 0), 0);
  const scelle = liste.filter((x) => x.categorie === "scelle"), cartes = liste.filter((x) => x.categorie === "carte");
  const valeur = somme(liste, (x) => x.valeur);
  const achat = somme(liste, (x) => x.cout);
  const gain = somme(liste.filter((x) => x.cout != null && x.valeur != null), (x) => x.valeur - x.cout);
  const nb = (l) => somme(l, (x) => x.quantite);
  const dates = liste.map((x) => x.prix_date).filter(Boolean).sort();
  return {
    valeur, achat, gain,
    gainPct: achat ? (gain / achat) * 100 : 0,
    scelle: { valeur: somme(scelle, (x) => x.valeur), nombre: nb(scelle) },
    cartes: { valeur: somme(cartes, (x) => x.valeur), nombre: nb(cartes) },
    partAchat: valeur ? Math.min(100, (achat / valeur) * 100) : 0, // jauge : part du prix payé dans la valeur
    dernierReleve: dates.at(-1) ?? null,
    enAttente: liste.filter((x) => x.prix_actuel == null).length,
  };
}

/* Tendance sur 30 jours : moyenne Cardmarket des 7 derniers jours comparée à celle des 30 derniers jours
   (les deux sur la même base, toutes langues). Notre propre historique FR prendra le relais quand il aura 30 jours. */
export function tendanceDepuisDetail(detail) {
  const m7 = Number(detail?.moy7), m30 = Number(detail?.moy30);
  return m7 > 0 && m30 > 0 ? (m7 / m30 - 1) * 100 : null;
}
// Tendance d'un ensemble : moyenne pondérée par la valeur de chaque objet
export function tendanceMoyenne(liste) {
  let s = 0, poids = 0;
  for (const x of liste) if (x.tendance != null && x.valeur > 0) { s += x.tendance * x.valeur; poids += x.valeur; }
  return poids ? s / poids : null;
}
export function etiquetteTendance(t, court = false) {
  if (t == null) return "";
  const r = Math.round(t);
  if (Math.abs(r) < 2) return `<span class="tendance stable">${court ? "= 30 j" : "stable sur 30 j"}</span>`;
  return `<span class="tendance ${r > 0 ? "hausse" : "baisse"}">${r > 0 ? "↗ +" : "↘ "}${r} %${court ? " 30 j" : " sur 30 j"}</span>`;
}

export const parPrix = (a, b) => Number(b.prix_actuel ?? -1) - Number(a.prix_actuel ?? -1);

// Courbe des prix (fiche carte)
export function courbe(points) {
  if (points.length < 2) return `<div class="historique"><p>L'historique des prix se construit à chaque relevé.</p></div>`;
  const v = points.map((p) => Number(p.prix)), min = Math.min(...v), max = Math.max(...v), w = 300, h = 60;
  const xy = v.map((y, i) => `${(i / (v.length - 1)) * w},${max === min ? h / 2 : h - ((y - min) / (max - min)) * h}`).join(" ");
  return `<div class="historique">
    <svg viewBox="-4 -4 ${w + 8} ${h + 8}" preserveAspectRatio="none" role="img" aria-label="Évolution du prix de ${euro(v[0])} à ${euro(v.at(-1))}">
      <polyline points="${xy}" pathLength="1" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    </svg>
    <p>${points.length} relevés, de ${euro(min)} à ${euro(max)}</p></div>`;
}
