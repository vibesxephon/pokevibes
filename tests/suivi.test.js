// Wishlist, alertes de prix et historique.
import { test } from "node:test";
import assert from "node:assert/strict";
import { memeCarte, historiqueValide, pointsSurPeriode, periodeParDefaut, extremes, gainPerte, seuilPropose, alertesDeLaCarte,
  libelleAlerte, dejaFranchi, trierWishlist, bonneAffaire } from "../js/suivi.js";

const espaces = (s) => s.replace(/\s/g, " ");
const MIDI = new Date("2026-11-11T12:00:00Z").getTime();

test("même carte : par produit ou par identifiant du catalogue", () => {
  assert.ok(memeCarte({ produit_id: 7 }, { produit_id: 7, tcgdex_id: "swsh7-1" }));
  assert.ok(memeCarte({ tcgdex_id: "swsh7-1" }, { produit_id: 7, tcgdex_id: "swsh7-1" }));
  assert.ok(!memeCarte({ produit_id: 7 }, { produit_id: 8 }));
  assert.ok(!memeCarte({ produit_id: null, tcgdex_id: null }, { produit_id: null, tcgdex_id: null })); // deux références vides ne se ressemblent pas
  assert.ok(!memeCarte(null, { produit_id: 1 }));
});

test("historique : relevés valides seulement, un par jour, du plus ancien au plus récent", () => {
  const h = historiqueValide([
    { le: "2026-11-10", prix: "12.5", valide: true }, { le: "2026-11-09", prix: 10, valide: true },
    { le: "2026-11-10", prix: 13, valide: true }, { le: "2026-11-08", prix: 99, valide: false }, { le: null, prix: 5 },
  ]);
  assert.deepEqual(h, [{ le: "2026-11-09", prix: 10 }, { le: "2026-11-10", prix: 13 }]);
  assert.deepEqual(historiqueValide(undefined), []);
});

test("périodes : 7 j / 30 j / 90 j (jour même compris) ou tout", () => {
  const p = ["2026-08-01", "2026-08-20", "2026-10-12", "2026-10-13", "2026-11-05", "2026-11-11"].map((le, i) => ({ le, prix: i }));
  assert.equal(pointsSurPeriode(p, 7, MIDI).length, 2);   // du 5 au 11 nov. : 5 et 11 nov.
  assert.equal(pointsSurPeriode(p, 30, MIDI).length, 3);  // du 13 oct. au 11 nov. : le 12 oct. n'y est pas
  assert.equal(pointsSurPeriode(p, 90, MIDI).length, 5);  // du 14 août au 11 nov. : le 1er août n'y est pas
  assert.equal(pointsSurPeriode(p, null, MIDI).length, 6);
  assert.equal(periodeParDefaut(p, MIDI), "30");
  assert.equal(periodeParDefaut([{ le: "2026-08-01", prix: 1 }, { le: "2026-09-01", prix: 2 }], MIDI), "tout");
});

test("prix min et max sur l'historique, avec leur date", () => {
  const { min, max } = extremes([{ le: "a", prix: 12 }, { le: "b", prix: 9.5 }, { le: "c", prix: 15 }, { le: "d", prix: 9.5 }]);
  assert.deepEqual([min, max], [{ le: "b", prix: 9.5 }, { le: "c", prix: 15 }]);
  assert.deepEqual(extremes([]), { min: null, max: null });
});

test("gain / perte d'une carte possédée", () => {
  assert.deepEqual(gainPerte(30, 20), { ecart: 10, pct: 50, sens: "gain" });
  assert.deepEqual(gainPerte(15, 20), { ecart: -5, pct: -25, sens: "perte" });
  assert.equal(gainPerte(20, 20).sens, "egal");
  assert.equal(gainPerte(20, null), null);   // tirée d'un booster : pas de prix d'achat
  assert.equal(gainPerte(null, 20), null);   // prix pas encore relevé
});

test("alerte : seuil proposé à −10 % du prix actuel (+10 % au-dessus), au centime", () => {
  assert.equal(seuilPropose(412.5), 371.25);
  assert.equal(seuilPropose(9.99), 8.99);
  assert.equal(seuilPropose(20, "dessus"), 22);
  assert.equal(seuilPropose(0.01), 0.01);
  assert.equal(seuilPropose(null), null);
  assert.equal(seuilPropose(0), null);
});

test("alerte : prévenir si le prix a déjà franchi le seuil", () => {
  assert.ok(dejaFranchi("dessous", 20, 18));
  assert.ok(!dejaFranchi("dessous", 20, 25));
  assert.ok(dejaFranchi("dessus", 20, 20));
  assert.ok(!dejaFranchi("dessous", 20, null));
});

test("alertes d'une carte et leur libellé (active, déclenchée le … à …)", () => {
  const alertes = [
    { id: 1, produit_id: 7, sens: "dessous", seuil: 18, active: true },
    { id: 2, tcgdex_id: "swsh7-1", sens: "dessus", seuil: 40, active: false, declenchee_le: "2026-11-10T07:30:00Z", prix_declenchement: 41.2 },
    { id: 3, produit_id: 9, sens: "dessous", seuil: 1, active: true },
  ];
  assert.deepEqual(alertesDeLaCarte(alertes, { produit_id: 7, tcgdex_id: "swsh7-1" }).map((a) => a.id), [1, 2]);
  assert.deepEqual(libelleAlerte(alertes[0]), { quand: "En dessous de 18,00 €".replace(/ €/, " €"), etat: "Active", declenchee: false });
  const l = libelleAlerte(alertes[1]);
  assert.equal(espaces(l.quand), "Au-dessus de 40,00 €");
  assert.equal(espaces(l.etat), "Déclenchée le 10 novembre 2026 à 41,20 €");
  assert.equal(libelleAlerte({ sens: "dessous", seuil: 5, active: false }).etat, "En pause");
});

test("Wishlist : tri par prix, par tendance, par date d'ajout ; les inconnus à la fin", () => {
  const c = [
    { nom: "A", prix: 10, tendance: 5, ajoute_le: "2026-11-01" },
    { nom: "B", prix: null, tendance: -3, ajoute_le: "2026-11-09" },
    { nom: "C", prix: 250, tendance: null, ajoute_le: "2026-11-05" },
  ];
  const noms = (cle) => trierWishlist(c, cle).map((x) => x.nom).join("");
  assert.equal(noms("prix"), "CAB");
  assert.equal(noms("tendance"), "ABC");
  assert.equal(noms("ajout"), "BCA");
  assert.deepEqual(c.map((x) => x.nom), ["A", "B", "C"]); // la liste d'origine n'est pas modifiée
});

test("Bonne affaire : alerte « en dessous » déclenchée, carte achetée ce jour-là ou après", () => {
  const alerte = (o) => ({ sens: "dessous", declenchee_le: "2026-11-05T09:00:00", produit_id: 7, ...o });
  const achat = (le, produit_id = 7) => [{ produit_id, achete_le: le }];
  assert.ok(bonneAffaire([alerte()], achat("2026-11-06")));
  assert.ok(bonneAffaire([alerte()], achat("2026-11-05")));          // le jour même
  assert.ok(!bonneAffaire([alerte()], achat("2026-11-04")));         // acheté avant l'alerte
  assert.ok(!bonneAffaire([alerte()], [{ produit_id: 7, achete_le: null }]));
  assert.ok(!bonneAffaire([alerte({ sens: "dessus" })], achat("2026-11-06")));
  assert.ok(!bonneAffaire([alerte({ declenchee_le: null })], achat("2026-11-06")));
  assert.ok(!bonneAffaire([alerte()], achat("2026-11-06", 8)));      // une autre carte
  // alerte posée sur une carte du catalogue : retrouvée par son produit
  assert.ok(bonneAffaire([alerte({ produit_id: null, tcgdex_id: "sv1-3" })], achat("2026-11-07", 42), new Map([["sv1-3", 42]])));
  assert.ok(!bonneAffaire([alerte({ produit_id: null, tcgdex_id: "sv1-3" })], achat("2026-11-07", 42)));
});
