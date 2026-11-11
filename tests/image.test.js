// Photo d'un produit : taille réduite avant l'envoi, chemin dans le stockage, messages d'erreur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dimensionsReduites, cheminPhoto, estImage, messageErreurPhoto, COTE_MAX, POIDS_MAX } from "../js/image.js";

test("le plus grand côté passe à 1200 px, proportions gardées, jamais agrandie", () => {
  assert.equal(COTE_MAX, 1200); assert.ok(POIDS_MAX <= 1024 * 1024);
  assert.deepEqual(dimensionsReduites(4032, 3024), { largeur: 1200, hauteur: 900 });
  assert.deepEqual(dimensionsReduites(3024, 4032), { largeur: 900, hauteur: 1200 });
  assert.deepEqual(dimensionsReduites(800, 600), { largeur: 800, hauteur: 600 });
  assert.deepEqual(dimensionsReduites(5000, 10), { largeur: 1200, hauteur: 2 });
  assert.equal(dimensionsReduites(0, 100), null);
});

test("chemin « <membre_id>/<horodatage>.jpg » et type de fichier", () => {
  assert.equal(cheminPhoto("1111-aaaa", 1731300000000), "1111-aaaa/1731300000000.jpg");
  assert.ok(estImage({ type: "image/heic" }));
  assert.ok(!estImage({ type: "application/pdf" }));
  assert.ok(!estImage(null));
});

test("photo refusée : message clair", () => {
  assert.match(messageErreurPhoto({ message: "ce produit a déjà une image" }), /vient d'ajouter une photo/);
  assert.match(messageErreurPhoto({ message: "The object exceeded the maximum allowed size" }), /trop lourde/);
  assert.match(messageErreurPhoto(new TypeError("Failed to fetch")), /Pas de connexion/);
});
