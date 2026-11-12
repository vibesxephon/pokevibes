/* PokeVibes — recherche dans l'index local des cartes Pokémon FR (pure, testable).
   Sans accents, plusieurs mots-clés, numéro seul (« 191 » = toutes les cartes 191/x et x/191), « nom + numéro »… */
import { cleNum, sansAccent } from "./format.js?v=17";

export function rechercheLocale(idx, q) {
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
