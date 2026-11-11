// Valeur totale, gain / perte, tendance 30 jours.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fusionner, totaux, tendanceDepuisDetail, tendanceMoyenne, etiquetteTendance, graphique } from "../js/prix.js";
import { euro, pct } from "../js/format.js";

// Une ligne de ma_collection = un achat (valeur = prix actuel × quantité, cout = prix d'achat × quantité)
const ligne = (o) => ({ produit_id: 1, defaut: false, categorie: "carte", quantite: 1, valeur: 10, cout: null, prix_actuel: 10, ...o });
const espaces = (s) => s.replace(/\s/g, " ");

test("fusionner : un même produit acheté plusieurs fois devient une seule pochette", () => {
  const [p] = fusionner([ligne({ quantite: 2, valeur: 100, cout: 60 }), ligne({ quantite: 1, valeur: 50, cout: 45 })]);
  assert.equal(p.quantite, 3);
  assert.equal(p.valeur, 150);
  assert.equal(p.cout, 105);
  assert.equal(p.prix_achat, 35); // moyenne pondérée : 105 € / 3
  assert.equal(p.benefice, 45);
  assert.ok(Math.abs(p.evolution_pct - 42.857) < 0.01);
});

test("fusionner : un exemplaire avec défaut reste une pochette à part", () => {
  const l = fusionner([ligne({}), ligne({ defaut: true })]);
  assert.equal(l.length, 2);
});

test("fusionner : sans prix d'achat, pas de plus-value calculée", () => {
  const [p] = fusionner([ligne({ cout: null })]);
  assert.equal(p.prix_achat, null);
  assert.equal(p.benefice, null);
  assert.equal(p.evolution_pct, null);
});

test("fusionner : un achat sans prix d'achat ne fausse pas le prix moyen des autres", () => {
  const [p] = fusionner([ligne({ cout: 20, valeur: 30 }), ligne({ cout: null, valeur: 30 })]);
  assert.equal(p.valeur, 60);
  assert.equal(p.cout, 20);
});

test("totaux : valeur totale, prix payé et plus-value", () => {
  const t = totaux([
    { categorie: "carte", quantite: 2, valeur: 200, cout: 100, prix_actuel: 100, prix_date: "2026-11-09" },
    { categorie: "carte", quantite: 1, valeur: 40, cout: null, prix_actuel: 40, prix_date: "2026-11-10" },
    { categorie: "scelle", quantite: 1, valeur: 189, cout: 60, prix_actuel: 189 },
    { categorie: "carte", quantite: 1, valeur: null, cout: 5, prix_actuel: null },
  ]);
  assert.equal(t.valeur, 429);
  assert.equal(t.achat, 165);
  // la plus-value ne compte que ce qui a un prix d'achat ET un prix actuel : (200-100) + (189-60)
  assert.equal(t.gain, 229);
  assert.ok(Math.abs(t.gainPct - (229 / 165) * 100) < 1e-9);
  assert.deepEqual(t.scelle, { valeur: 189, nombre: 1 });
  assert.deepEqual(t.cartes, { valeur: 240, nombre: 4 });
  assert.equal(t.enAttente, 1);
  assert.equal(t.dernierReleve, "2026-11-10");
  assert.ok(Math.abs(t.partAchat - (165 / 429) * 100) < 1e-9);
});

test("totaux : perte quand la valeur est sous le prix payé", () => {
  const t = totaux([{ categorie: "carte", quantite: 1, valeur: 30, cout: 50, prix_actuel: 30 }]);
  assert.equal(t.gain, -20);
  assert.equal(t.gainPct, -40);
  assert.equal(espaces(pct(t.gainPct)), "-40 %");
  assert.equal(espaces(euro(t.gain, 0)), "-20 €");
});

test("totaux : collection vide → tout à zéro, pas de division par zéro", () => {
  const t = totaux([]);
  assert.deepEqual([t.valeur, t.achat, t.gain, t.gainPct, t.partAchat, t.enAttente, t.dernierReleve], [0, 0, 0, 0, 0, 0, null]);
});

test("totaux : la jauge du prix payé ne dépasse jamais 100 %", () => {
  assert.equal(totaux([{ categorie: "carte", quantite: 1, valeur: 10, cout: 50, prix_actuel: 10 }]).partAchat, 100);
});

test("tendance 30 j : moyenne 7 jours comparée à la moyenne 30 jours", () => {
  assert.ok(Math.abs(tendanceDepuisDetail({ moy7: 11, moy30: 10 }) - 10) < 1e-9);
  assert.ok(Math.abs(tendanceDepuisDetail({ moy7: "9", moy30: "12" }) - -25) < 1e-9);
  assert.equal(tendanceDepuisDetail({ moy7: 0, moy30: 10 }), null);
  assert.equal(tendanceDepuisDetail({ moy7: 5 }), null);
  assert.equal(tendanceDepuisDetail(undefined), null);
});

test("tendance d'un ensemble : moyenne pondérée par la valeur", () => {
  const t = tendanceMoyenne([{ tendance: 10, valeur: 300 }, { tendance: -20, valeur: 100 }, { tendance: null, valeur: 1000 }, { tendance: 50, valeur: 0 }]);
  assert.equal(t, 2.5); // (10×300 − 20×100) / 400
  assert.equal(tendanceMoyenne([{ tendance: null, valeur: 10 }]), null);
  assert.equal(tendanceMoyenne([]), null);
});

test("étiquette de tendance : stable sous 2 %, sinon hausse ou baisse arrondie", () => {
  assert.match(etiquetteTendance(1.4), /stable sur 30 j/);
  assert.match(etiquetteTendance(-1.6), /baisse">↘ -2 %/); // arrondi à −2 → baisse
  assert.match(etiquetteTendance(-1.4), /stable/);
  assert.match(etiquetteTendance(12.6), /class="tendance hausse">↗ \+13 % sur 30 j/);
  assert.match(etiquetteTendance(-8.2), /class="tendance baisse">↘ -8 % sur 30 j/);
  assert.match(etiquetteTendance(5, true), /\+5 % 30 j/);
  assert.equal(etiquetteTendance(null), "");
});

test("graphique de l'historique : du premier au dernier prix, abscisse selon les dates", () => {
  const g = espaces(graphique([{ le: "2026-11-01", prix: 10 }, { le: "2026-11-02", prix: 30 }, { le: "2026-11-11", prix: 20 }], { titre: "sur 30 jours" }));
  assert.match(g, /Évolution du prix sur 30 jours : de 10,00 € le 1 nov\. à 20,00 € le 11 nov\./);
  assert.match(g, /3 relevés/);
  // 2 nov. est à 1/10 de la largeur (320) : x = 32 ; le prix max (30) est en haut, à la marge (12 % de 120)
  assert.match(g, /points="0,105\.6 32,14\.4 320,60"/);
  assert.match(g, /class="graphe-zone hausse"/);
  assert.match(graphique([{ le: "2026-11-01", prix: 30 }, { le: "2026-11-02", prix: 20 }]), /graphe-zone baisse/);
  // prix constant : ligne au milieu
  assert.match(graphique([{ le: "2026-11-01", prix: 5 }, { le: "2026-11-03", prix: 5 }]), /points="0,60 320,60"/);
});
