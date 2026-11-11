// Conditions des badges : données du membre → badges gagnés.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BADGES, FAMILLES, RARETES } from "../badges.js";
import { donneesBadges, badgesAGagner, progresTexte, ouvertureANoter, issueScan, statsClasseurPur, compterSniperPur, mesurer } from "../js/badges-regles.js";

// Un mercredi à midi (heure locale) : aucune heure « secrète » n'est atteinte par défaut
const MIDI = new Date(2026, 10, 11, 12, 0).getTime();
const jour = 864e5;
const le = (j, h = 12) => new Date(2026, 10, 11 - j, h, 0).toISOString(); // il y a j jours, à h heures
const gagnes = (entrees) => badgesAGagner(donneesBadges({ maintenant: MIDI, ...entrees }), new Set()).map((b) => b.id);
const gagne = (id, entrees) => gagnes(entrees).includes(id);
const carte = (o) => ({ categorie: "carte", jeu: "pokemon", quantite: 1, prix_actuel: 1, extension: "Évolution Céleste", ...o });
const stats = (o) => ({ cartes: 0, quantite: 0, meilleurePct: 0, extensions50: 0, secretes: false, noms: [], ...o });
const repete = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test("configuration : 30 badges complets, identifiants uniques, 7 familles", () => {
  assert.equal(BADGES.length, 30);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 30);
  for (const b of BADGES) {
    assert.ok(FAMILLES.includes(b.famille), `${b.id} : famille`);
    assert.ok(RARETES[b.rarete], `${b.id} : rareté`);
    assert.ok(b.dessin?.includes("<"), `${b.id} : dessin`);
    assert.ok(b.cible > 0 && typeof b.mesure === "function" && b.nom && b.condition, `${b.id} : condition`);
  }
  assert.deepEqual(BADGES.filter((b) => b.secret).map((b) => b.id), ["oiseau-de-nuit", "leve-tot", "fidele", "un-an-deja"]);
});

test("membre tout neuf : aucun badge", () => {
  assert.deepEqual(gagnes({}), []);
});

test("Scanner : premier scan, 50, 250", () => {
  const scans = (n) => repete(n, (i) => ({ type: "scan", le: le(i % 40) }));
  assert.ok(gagne("premier-scan", { activite: scans(1) }));
  assert.ok(!gagne("scans-50", { activite: scans(49) }));
  assert.ok(gagne("scans-50", { activite: scans(50) }));
  assert.ok(!gagne("scans-250", { activite: scans(249) }));
  assert.ok(gagne("scans-250", { activite: scans(250) }));
});

test("Rafale : 10 scans le même jour (pas sur deux jours)", () => {
  assert.ok(gagne("rafale", { activite: repete(10, (i) => ({ type: "scan", le: le(0, 8 + i) })) }));
  assert.ok(!gagne("rafale", { activite: [...repete(9, () => ({ type: "scan", le: le(0) })), { type: "scan", le: le(1) }] }));
});

test("Œil de lynx : 10 scans reconnus d'affilée, une correction remet à zéro", () => {
  const r = { type: "scan_reconnu", le: le(0) }, c = { type: "scan_corrige", le: le(0) };
  assert.ok(gagne("oeil-de-lynx", { activite: [...repete(3, () => r), c, ...repete(10, () => r)] }));
  assert.ok(!gagne("oeil-de-lynx", { activite: [...repete(9, () => r), c, ...repete(9, () => r)] }));
  // les ouvertures et scans entre deux ne cassent pas la série
  assert.ok(gagne("oeil-de-lynx", { activite: [...repete(5, () => r), { type: "ouverture", le: le(0) }, { type: "scan", le: le(0) }, ...repete(5, () => r)] }));
});

test("Collection : 50 et 250 cartes (quantités comptées), scellé exclu", () => {
  assert.ok(gagne("collectionneur", { lignes: [carte({ quantite: 50 })] }));
  assert.ok(!gagne("collectionneur", { lignes: [carte({ quantite: 49 }), { categorie: "scelle", quantite: 5 }] }));
  assert.ok(gagne("grand-collectionneur", { lignes: repete(5, () => carte({ quantite: 50 })) }));
});

test("Première pépite (> 50 €) et Trésor (> 200 €), au prix d'une carte", () => {
  assert.ok(!gagne("premiere-pepite", { lignes: [carte({ prix_actuel: 50 })] }));
  assert.ok(gagne("premiere-pepite", { lignes: [carte({ prix_actuel: 50.01 })] }));
  assert.ok(!gagne("tresor", { lignes: [carte({ prix_actuel: 200 })] }));
  assert.ok(gagne("tresor", { lignes: [carte({ prix_actuel: 412.5 })] }));
  assert.ok(!gagne("tresor", { lignes: [{ categorie: "scelle", quantite: 1, prix_actuel: 500 }] })); // un scellé n'est pas une carte
});

test("Scellé : premier scellé, 10 scellés", () => {
  assert.ok(gagne("sous-blister", { lignes: [{ categorie: "scelle", quantite: 1 }] }));
  assert.ok(!gagne("gardien-du-scelle", { lignes: [{ categorie: "scelle", quantite: 9 }] }));
  assert.ok(gagne("gardien-du-scelle", { lignes: [{ categorie: "scelle", quantite: 6 }, { categorie: "scelle", quantite: 4 }] }));
});

test("Classeur : page, mi-parcours, trois de front, master set, secrètes, grand classeur", () => {
  assert.ok(gagne("premiere-page", { classeur: stats({ cartes: 10 }) }));
  assert.ok(!gagne("mi-parcours", { classeur: stats({ meilleurePct: 49 }) }));
  assert.ok(gagne("mi-parcours", { classeur: stats({ meilleurePct: 50 }) }));
  assert.ok(gagne("trois-de-front", { classeur: stats({ extensions50: 3 }) }));
  assert.ok(!gagne("master-set", { classeur: stats({ meilleurePct: 99 }) }));
  assert.ok(gagne("master-set", { classeur: stats({ meilleurePct: 100 }) }));
  assert.ok(gagne("chasseur-de-secretes", { classeur: stats({ secretes: true }) }));
  assert.ok(gagne("grand-classeur", { classeur: stats({ cartes: 500 }) }));
});

test("statistiques du Classeur à partir des cartes cochées", () => {
  const idx = {
    sets: new Map([["a", { nom: "A", total: 2 }], ["b", { nom: "B", total: 4 }]]),
    cartes: [["a", "1"], ["a", "2"], ["a", "3"], ["b", "1"], ["b", "2"], ["b", "3"], ["b", "4"]].map(([s, n]) => ({ id: `${s}-${n}`, localId: n, set: { id: s } })),
  };
  const classeur = new Map([["a-1", { set_id: "a", quantite: 2 }], ["a-2", { set_id: "a", quantite: 1 }], ["a-3", { set_id: "a", quantite: 1 }], ["b-1", { set_id: "b", quantite: 1 }]]);
  const s = statsClasseurPur(classeur, idx);
  assert.deepEqual([s.cartes, s.quantite, s.meilleurePct, s.extensions50, s.secretes], [4, 5, 100, 1, true]);
  assert.deepEqual(s.noms.sort(), ["A", "B"]);
  // index indisponible : seuls les nombres de cartes sont connus
  assert.deepEqual([statsClasseurPur(classeur, null).cartes, statsClasseurPur(classeur, null).meilleurePct], [4, 0]);
});

test("Globe-trotteur : 10 extensions différentes (accents et majuscules ignorés)", () => {
  const lignes = repete(9, (i) => carte({ extension: `Extension ${i}` }));
  assert.ok(!gagne("globe-trotteur", { lignes: [...lignes, carte({ extension: "Extension 0" })] }));
  assert.ok(!gagne("globe-trotteur", { lignes: [...lignes.slice(0, 8), carte({ extension: "Évolution Céleste" }), carte({ extension: "evolution celeste" })] }));
  assert.ok(gagne("globe-trotteur", { lignes, classeur: stats({ noms: ["Écarlate et Violet"] }) }));
});

test("Pirate et Double casquette", () => {
  assert.ok(gagne("pirate", { lignes: [carte({ jeu: "onepiece" })] }));
  assert.ok(!gagne("double-casquette", { lignes: [carte({ quantite: 10 }), carte({ jeu: "onepiece", quantite: 9 })] }));
  assert.ok(gagne("double-casquette", { lignes: [carte({ quantite: 4 }), carte({ jeu: "onepiece", quantite: 10 })], classeur: stats({ quantite: 6 }) }));
});

test("Premier gain et Bon flair (+30 %)", () => {
  assert.ok(!gagne("premier-gain", { lignes: [carte({ prix_achat: 20, prix_actuel: 20 })] }));
  assert.ok(gagne("premier-gain", { lignes: [carte({ prix_achat: 20, prix_actuel: 20.5 })] }));
  assert.ok(!gagne("bon-flair", { lignes: [carte({ prix_achat: 100, prix_actuel: 129.9 })] }));
  assert.ok(gagne("bon-flair", { lignes: [carte({ prix_achat: 100, prix_actuel: 130 })] }));
  assert.ok(!gagne("premier-gain", { lignes: [carte({ prix_achat: null, prix_actuel: 999 })] })); // pas de prix d'achat : pas de gain
});

test("Sniper : payée au moins 20 % sous le prix du marché du jour", () => {
  const achat = (prix, date = "2026-05-10") => [{ produit_id: 7, defaut: false, achete_le: date, prix_achat: prix }];
  const h = [{ produit_id: 7, etat_prix: "standard", le: "2026-05-01", prix: 30 }, { produit_id: 7, etat_prix: "standard", le: "2026-05-08", prix: 40 }, { produit_id: 7, etat_prix: "standard", le: "2026-05-20", prix: 100 }];
  assert.equal(compterSniperPur(achat(32), h), 1); // 40 → 32 = −20 %
  assert.equal(compterSniperPur(achat(33), h), 0);
  // aucun relevé avant l'achat : celui des 7 jours suivants
  assert.equal(compterSniperPur(achat(24, "2026-04-26"), h), 1);
  assert.equal(compterSniperPur(achat(24, "2026-04-20"), h), 0); // 11 jours avant le premier relevé : inconnu
  // un exemplaire avec défaut se compare au prix « défaut »
  assert.equal(compterSniperPur([{ produit_id: 7, defaut: true, achete_le: "2026-05-10", prix_achat: 10 }], h), 0);
  assert.ok(gagne("sniper", { sniper: 1 }));
});

test("Mains de diamant : une carte achetée il y a 6 mois (182 jours)", () => {
  const achete = (j) => [carte({ achete_le: new Date(MIDI - j * jour).toISOString().slice(0, 10) })];
  assert.ok(!gagne("mains-de-diamant", { lignes: achete(180) }));
  assert.ok(gagne("mains-de-diamant", { lignes: achete(183) }));
});

test("Ventes : première vente, plus-value frais compris", () => {
  assert.ok(gagne("premiere-vente", { ventes: [{ quantite: 1, prix_vente: 5, prix_achat: 10, frais: 0 }] }));
  assert.ok(!gagne("plus-value", { ventes: [{ quantite: 1, prix_vente: 30, prix_achat: 20, frais: 10 }] })); // tout juste à l'équilibre
  assert.ok(gagne("plus-value", { ventes: [{ quantite: 1, prix_vente: 30, prix_achat: 20, frais: 9 }] }));
  assert.ok(gagne("plus-value", { ventes: [{ quantite: 3, prix_vente: 10, prix_achat: 8, frais: 5 }] })); // 30 > 24 + 5
  assert.ok(!gagne("plus-value", { ventes: [{ quantite: 1, prix_vente: 30, prix_achat: null, frais: 0 }] })); // prix d'achat inconnu
});

test("Secrets : heures d'ouverture (2 h–5 h, 5 h–7 h)", () => {
  const ouverture = (h) => ({ activite: [{ type: "ouverture", le: le(3, h) }] });
  assert.ok(gagne("oiseau-de-nuit", ouverture(2)));
  assert.ok(gagne("oiseau-de-nuit", ouverture(4)));
  assert.ok(!gagne("oiseau-de-nuit", ouverture(5)));
  assert.ok(gagne("leve-tot", ouverture(6)));
  assert.ok(!gagne("leve-tot", ouverture(7)));
  // l'ouverture en cours compte : ouvrir à 3 h du matin débloque tout de suite
  assert.ok(badgesAGagner(donneesBadges({ maintenant: new Date(2026, 10, 11, 3, 10).getTime() }), new Set()).some((b) => b.id === "oiseau-de-nuit"));
});

test("Fidèle : 30 jours d'ouverture différents (le jour même compte)", () => {
  const jours = (n) => repete(n, (i) => ({ type: "ouverture", le: le(i + 1) }));
  assert.ok(!gagne("fidele", { activite: [...jours(28), { type: "ouverture", le: le(1, 18) }] }));
  assert.ok(gagne("fidele", { activite: jours(29) }));
});

test("Un an déjà : ouverte un an après l'inscription", () => {
  assert.ok(!gagne("un-an-deja", { creeLe: new Date(MIDI - 364 * jour).toISOString() }));
  assert.ok(gagne("un-an-deja", { creeLe: new Date(MIDI - 365 * jour).toISOString() }));
});

test("un badge déjà obtenu n'est jamais redonné", () => {
  const d = donneesBadges({ maintenant: MIDI, activite: [{ type: "scan", le: le(0) }] });
  assert.deepEqual(badgesAGagner(d, new Set(["premier-scan"])).map((b) => b.id), []);
  assert.deepEqual(badgesAGagner(d, new Map([["premier-scan", "2026-10-01"]])).map((b) => b.id), []);
});

test("progression affichée : « 37 / 50 scans », plafonnée à la cible", () => {
  const b = (id) => BADGES.find((x) => x.id === id);
  const d = donneesBadges({ maintenant: MIDI, activite: repete(37, () => ({ type: "scan", le: le(2) })) });
  assert.equal(progresTexte(b("scans-50"), d), "37 / 50 scans");
  assert.equal(progresTexte(b("premier-scan"), d), "1 / 1 scan");
  assert.equal(progresTexte(b("mi-parcours"), donneesBadges({ maintenant: MIDI, classeur: stats({ meilleurePct: 32 }) })), "32 / 50 %");
  assert.equal(progresTexte(b("tresor"), d), ""); // badge sans progression
});

test("une mesure qui plante compte comme 0 (jamais d'erreur visible)", () => {
  assert.equal(mesurer({ mesure: () => { throw new Error("x"); } }, {}), 0);
  assert.equal(mesurer({ mesure: () => undefined }, {}), 0);
});

test("journal : une ouverture au plus par heure", () => {
  const maintenant = MIDI;
  assert.equal(ouvertureANoter([], maintenant), true);
  assert.equal(ouvertureANoter([{ type: "ouverture", le: new Date(maintenant - 30 * 60e3).toISOString() }], maintenant), false);
  assert.equal(ouvertureANoter([{ type: "ouverture", le: new Date(maintenant - 61 * 60e3).toISOString() }], maintenant), true);
  assert.equal(ouvertureANoter([{ type: "scan", le: new Date(maintenant).toISOString() }], maintenant), true);
});

test("journal : scan reconnu si la carte proposée par l'IA est gardée, corrigé sinon", () => {
  assert.equal(issueScan("swsh7-3", "swsh7-3"), "scan_reconnu");
  assert.equal(issueScan("swsh7-3", "swsh7-12"), "scan_corrige");
  assert.equal(issueScan(null, null), "scan_corrige"); // l'IA n'avait rien proposé
  assert.equal(issueScan("swsh7-3", null), "scan_corrige");
});
