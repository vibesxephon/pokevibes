/* PokeVibes — règles du Classeur (calculs purs, testés dans tests/progression.test.js).
   Collection = la valeur (ex, promos, illustrations… ou plus de 2 €).
   Classeur = toutes les cartes d'une extension, communes comprises, pour la compléter. */

export const RARETES_COMMUNES = /^(commune|peu commune|rare|holo rare|rare holo|sans rareté|aucune)$/i;
export const SEUIL_COLLECTION = 2; // €

// Où ranger une carte qu'on ajoute : Collection ou Classeur, avec la phrase d'explication affichée
export function destinationConseillee(rarete, prix) {
  const commune = RARETES_COMMUNES.test(String(rarete ?? "").trim());
  if (!commune) return { destination: "collection", aide: "Carte rare (ex, promo, illustration…) : rangée dans ta Collection." };
  if (prix >= SEUIL_COLLECTION) return { destination: "collection", aide: `Carte commune, mais elle vaut plus de ${SEUIL_COLLECTION} € : rangée dans ta Collection.` };
  return { destination: "classeur", aide: "Carte commune à petit prix : rangée dans ton Classeur." };
}

export const rangNum = (c) => { const n = parseInt(c.localId, 10); return isNaN(n) ? 100000 : n; };

/* Progression d'une extension.
   idx : index des cartes ({ sets: Map, cartes: [...] }) ; sid : identifiant de l'extension ;
   possedees : Map (ou Set) des identifiants de cartes cochées dans le Classeur.
   Les cartes au-delà du numéro officiel (ex. 210/203) ou à numéro non numérique sont des secrètes :
   elles ne comptent pas dans le pourcentage, elles sont suivies à part. */
export function compteSet(idx, sid, possedees = new Map()) {
  const set = idx.sets.get(sid);
  const cartes = idx.cartes.filter((c) => c.set?.id === sid).sort((a, b) => rangNum(a) - rangNum(b) || String(a.localId).localeCompare(String(b.localId)));
  const off = set?.total || cartes.length;
  let normales = 0, secretes = 0, nbSec = 0;
  for (const c of cartes) {
    const n = parseInt(c.localId, 10), sec = !(n >= 1 && n <= off) || !/^\d+$/.test(String(c.localId));
    if (sec) nbSec++;
    if (possedees.has(c.id)) sec ? secretes++ : normales++;
  }
  return { set, cartes, off, normales, secretes, nbSec, pct: off ? Math.round((normales / off) * 100) : 0 };
}
