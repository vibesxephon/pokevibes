/* PokeVibes — prix, valeur, plus-value et tendance 30 jours (calculs purs, testés dans tests/prix.test.js). */
import { euro } from "./format.js?v=15";

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

/* Graphique de l'historique (fiche carte). points : [{ le: "AAAA-MM-JJ", prix }] triés, au moins 2.
   Abscisse proportionnelle aux dates ; une marge en haut et en bas pour que la courbe ne touche pas les bords.
   Le dernier prix est marqué par un point (en HTML, pour rester rond quelle que soit la largeur). */
export function graphique(points, { titre = "" } = {}) {
  const W = 320, H = 120, marge = 0.12;
  const t = points.map((p) => new Date(p.le).getTime()), v = points.map((p) => Number(p.prix));
  const t0 = t[0], t1 = t.at(-1), min = Math.min(...v), max = Math.max(...v);
  const x = (i) => (t1 === t0 ? (i / Math.max(1, points.length - 1)) : (t[i] - t0) / (t1 - t0)) * W;
  const y = (i) => (max === min ? H / 2 : H * (1 - marge - (1 - 2 * marge) * ((v[i] - min) / (max - min))));
  const r = (n) => Math.round(n * 10) / 10;
  const xy = points.map((_, i) => `${r(x(i))},${r(y(i))}`).join(" ");
  const aire = `M${r(x(0))},${H} L${xy.replace(/ /g, " L")} L${r(x(points.length - 1))},${H} Z`;
  const jour = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const hausse = v.at(-1) >= v[0];
  return `<div class="graphe-zone ${hausse ? "hausse" : "baisse"}">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Évolution du prix${titre ? ` ${titre}` : ""} : de ${euro(v[0])} le ${jour(points[0].le)} à ${euro(v.at(-1))} le ${jour(points.at(-1).le)}">
        <path class="graphe-aire" d="${aire}"/>
        <polyline class="graphe-ligne" points="${xy}" pathLength="1" fill="none" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
      </svg>
      <span class="graphe-point" style="left:${r((x(points.length - 1) / W) * 100)}%;top:${r((y(points.length - 1) / H) * 100)}%" aria-hidden="true"></span>
    </div>
    <div class="graphe-axe" aria-hidden="true"><span>${jour(points[0].le)}</span><span>${points.length} relevés</span><span>${jour(points.at(-1).le)}</span></div>`;
}
