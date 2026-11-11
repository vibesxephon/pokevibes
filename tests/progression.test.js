// Progression du Classeur et règle Collection / Classeur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { destinationConseillee, compteSet, rangNum, SEUIL_COLLECTION } from "../js/progression.js";

test("règle : une carte rare va dans la Collection, quel que soit son prix", () => {
  for (const r of ["Illustration rare", "SAR", "Ultra Rare", "Promo", "ex"]) assert.equal(destinationConseillee(r, 0.1).destination, "collection", r);
});

test("règle : une carte commune à petit prix va dans le Classeur", () => {
  for (const r of ["Commune", "peu commune", "Rare", "Holo Rare", "Rare Holo", "Sans Rareté", "Aucune", "  Commune  "])
    assert.equal(destinationConseillee(r, 0.5).destination, "classeur", r);
});

test("règle : une commune qui vaut 2 € ou plus va dans la Collection", () => {
  assert.equal(SEUIL_COLLECTION, 2);
  assert.equal(destinationConseillee("Commune", 2).destination, "collection");
  assert.equal(destinationConseillee("Commune", 1.99).destination, "classeur");
  assert.match(destinationConseillee("Commune", 5).aide, /plus de 2 €/);
});

test("règle : prix inconnu → la commune va dans le Classeur", () => {
  assert.equal(destinationConseillee("Commune", null).destination, "classeur");
  assert.equal(destinationConseillee("Commune", undefined).destination, "classeur");
});

test("règle : rareté inconnue → Collection (on ne range pas au hasard une carte peut-être rare)", () => {
  assert.equal(destinationConseillee(null, 0.2).destination, "collection");
});

// Petite extension : 5 cartes officielles + 2 secrètes (6/5 et TG01)
const idx = {
  sets: new Map([["ext", { id: "ext", nom: "Extension test", total: 5 }]]),
  cartes: ["3", "1", "TG01", "5", "2", "6", "4"].map((n) => ({ id: `ext-${n}`, localId: n, set: { id: "ext" } })),
};

test("progression : pourcentage sur les cartes officielles, secrètes à part", () => {
  const k = compteSet(idx, "ext", new Map([["ext-1", {}], ["ext-2", {}], ["ext-6", {}]]));
  assert.equal(k.off, 5);
  assert.equal(k.normales, 2);
  assert.equal(k.pct, 40);
  assert.equal(k.nbSec, 2);
  assert.equal(k.secretes, 1);
});

test("progression : les cartes sont triées par numéro, secrètes à la fin", () => {
  assert.deepEqual(compteSet(idx, "ext").cartes.map((c) => c.localId), ["1", "2", "3", "4", "5", "6", "TG01"]);
});

test("progression : extension complète = 100 %, toutes les secrètes", () => {
  const toutes = new Set(idx.cartes.map((c) => c.id));
  const k = compteSet(idx, "ext", toutes);
  assert.equal(k.pct, 100);
  assert.equal(k.secretes, k.nbSec);
});

test("progression : arrondi au pourcent le plus proche", () => {
  const big = { sets: new Map([["b", { total: 3 }]]), cartes: ["1", "2", "3"].map((n) => ({ id: `b-${n}`, localId: n, set: { id: "b" } })) };
  assert.equal(compteSet(big, "b", new Set(["b-1"])).pct, 33);
  assert.equal(compteSet(big, "b", new Set(["b-1", "b-2"])).pct, 67);
});

test("progression : sans total officiel, on prend le nombre de cartes connues", () => {
  const sansTotal = { sets: new Map([["s", { nom: "Sans total" }]]), cartes: ["1", "2"].map((n) => ({ id: `s-${n}`, localId: n, set: { id: "s" } })) };
  const k = compteSet(sansTotal, "s", new Set(["s-1"]));
  assert.equal(k.off, 2);
  assert.equal(k.pct, 50);
});

test("progression : extension vide ou inconnue → 0 %", () => {
  assert.equal(compteSet({ sets: new Map(), cartes: [] }, "rien").pct, 0);
});

test("numéro non numérique rangé à la fin", () => {
  assert.equal(rangNum({ localId: "TG05" }), 100000);
  assert.equal(rangNum({ localId: "007" }), 7);
});
