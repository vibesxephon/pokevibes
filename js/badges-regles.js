/* PokeVibes — calcul des conditions des badges (pur : sans page ni réseau, testé dans tests/badges.test.js).
   Les badges eux-mêmes (nom, rareté, condition, mesure, cible, dessin) sont décrits dans badges.js. */
import { BADGES } from "../badges.js?v=14";
import { sansAccent, jourLocal } from "./format.js?v=14";
import { compteSet } from "./progression.js?v=14";

export const mesurer = (b, d) => { try { return Number(b.mesure(d)) || 0; } catch { return 0; } };

// Badges à décerner : conditions remplies et pas encore obtenus (obtenus : Map ou Set des identifiants)
export const badgesAGagner = (d, obtenus) => BADGES.filter((b) => !obtenus.has(b.id) && mesurer(b, d) >= b.cible);

// « 37 / 50 scans » (vide pour les badges sans progression)
export function progresTexte(b, d) {
  if (!b.unite) return "";
  return `${Math.min(mesurer(b, d), b.cible)} / ${b.cible}${b.unite === "%" ? " %" : ` ${b.unite}`}`;
}

// Une ouverture de l'appli est notée au plus une fois par heure
export function ouvertureANoter(activite, maintenant = Date.now()) {
  const derniere = activite.filter((x) => x.type === "ouverture").at(-1);
  return !derniere || maintenant - new Date(derniere.le).getTime() > 36e5;
}

// Scan : la proposition de l'IA (sig) est-elle gardée au moment de valider (choisi) ?
export const issueScan = (sig, choisi) => (sig != null && choisi === sig ? "scan_reconnu" : "scan_corrige");

// Statistiques du Classeur (Pokémon) ; sans index des cartes, seuls les nombres de cartes sont connus
export function statsClasseurPur(classeur, idx) {
  const r = { cartes: classeur.size, quantite: 0, meilleurePct: 0, extensions50: 0, secretes: false, noms: [] };
  for (const x of classeur.values()) r.quantite += x.quantite ?? 1;
  if (!idx) return r;
  for (const sid of new Set([...classeur.values()].map((x) => x.set_id))) {
    const k = compteSet(idx, sid, classeur);
    r.meilleurePct = Math.max(r.meilleurePct, k.pct);
    if (k.pct >= 50) r.extensions50++;
    if (k.nbSec > 0 && k.secretes === k.nbSec) r.secretes = true;
    if (k.set?.nom) r.noms.push(k.set.nom);
  }
  return r;
}

// Sniper : prix d'achat au moins 20 % sous le prix du marché du jour de l'achat
// (dernier relevé avant l'achat, sinon un relevé dans les 7 jours après)
export function compterSniperPur(lignes, historique) {
  let n = 0;
  for (const x of lignes) {
    if (!x.achete_le || !(Number(x.prix_achat) > 0)) continue;
    const h = historique.filter((p) => p.produit_id === x.produit_id && p.etat_prix === (x.defaut ? "defaut" : "standard"));
    const avant = h.filter((p) => p.le <= x.achete_le).at(-1);
    const apres = h.find((p) => p.le > x.achete_le && (new Date(p.le) - new Date(x.achete_le)) <= 7 * 864e5);
    const marche = Number((avant ?? apres)?.prix);
    if (marche > 0 && Number(x.prix_achat) <= marche * 0.8) n++;
  }
  return n;
}

/* Données du membre utilisées par les mesures des badges.
   activite : journal (scan, scan_reconnu, scan_corrige, ouverture) ; lignes : ma_collection (une ligne par exemplaire acheté) ;
   classeur : résultat de statsClasseurPur ; ventes : table ventes ; creeLe : date d'inscription. */
export function donneesBadges({ activite = [], lignes = [], classeur, sniper = 0, ventes = [], creeLe = null, maintenant = Date.now() }) {
  const a = activite, cl = classeur ?? { cartes: 0, quantite: 0, meilleurePct: 0, extensions50: 0, secretes: false, noms: [] };
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
  // l'ouverture en cours compte aussi
  const ouvertures = [...a.filter((x) => x.type === "ouverture").map((x) => new Date(x.le)), new Date(maintenant)];
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
    ventes: ventes.length,
    ventesGagnantes: ventes.filter((v) => v.prix_achat != null && Number(v.prix_vente) * (v.quantite ?? 1) > Number(v.prix_achat) * (v.quantite ?? 1) + Number(v.frais ?? 0)).length,
    heures: ouvertures.map((d) => d.getHours()),
    joursOuverture: new Set(ouvertures.map(jourLocal)).size,
    anciennete: creeLe ? maintenant - new Date(creeLe).getTime() : 0,
  };
}
