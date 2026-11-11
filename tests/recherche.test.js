// Recherche dans l'index local des cartes (scanner et recherche par nom / numéro).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rechercheLocale } from "../js/recherche.js";
import { sansAccent, cleNum } from "../js/format.js";

const sets = new Map([["swsh7", { id: "swsh7", nom: "Évolution Céleste", total: 203, ordre: 2 }], ["sv1", { id: "sv1", nom: "Écarlate et Violet", total: 198, ordre: 3 }]]);
const c = (id, localId, name) => { const set = sets.get(id.split("-")[0]); return { id, localId, name, set, n: cleNum(localId), cle: ` ${sansAccent(`${name} ${set.nom}`)} ` }; };
const idx = { sets, cartes: [c("swsh7-215", "215", "Noctali VMAX"), c("swsh7-3", "3", "Phyllali"), c("sv1-3", "3", "Pohm"), c("sv1-203", "203", "Dracaufeu ex"), c("swsh7-TG05", "TG05", "Mentali")] };
const ids = (q) => rechercheLocale(idx, q).map((x) => x.id);

test("par nom, sans accents ni majuscules", () => {
  assert.deepEqual(ids("noctali"), ["swsh7-215"]);
  assert.deepEqual(ids("DRACAUFEU"), ["sv1-203"]);
  assert.deepEqual(ids("phyllali evolution"), ["swsh7-3"]);
});

test("par numéro « x/total » : la bonne extension", () => {
  assert.deepEqual(ids("3/203"), ["swsh7-3"]);
  assert.deepEqual(ids("003/198"), ["sv1-3"]);
});

test("numéro seul : la carte de ce numéro d'abord, puis l'extension de ce total", () => {
  const l = ids("203");
  assert.equal(l[0], "sv1-203");
  assert.ok(l.includes("swsh7-3") && l.includes("swsh7-215"));
});

test("numéros spéciaux (TG) et zéros en tête", () => {
  assert.deepEqual(ids("tg5"), ["swsh7-TG05"]);
  assert.deepEqual(ids("TG05"), ["swsh7-TG05"]);
});

test("recherche vide ou sans résultat", () => {
  assert.deepEqual(ids("   "), []);
  assert.deepEqual(ids("mewtwo"), []);
});
