// Niveaux, titres et camps : mise en forme de ce que renvoie le serveur (aucune XP n'est calculée côté site).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPS, KONAMI, TITRES_CAMP, avancerKonami, cleConnexion, jourParis, libelleGain, lireGain, listeNiveaux, messageErreurCamp, pctXp, sourceBadge, texteXp, titreDe, trierParNiveau } from "../js/niveaux.js";

test("titres : les mêmes paliers que titre_niveau sur le serveur", () => {
  assert.equal(titreDe(1), "Apprenti dresseur");
  assert.equal(titreDe(4), "Apprenti dresseur");
  assert.equal(titreDe(5), "Gamin des hautes herbes");
  assert.equal(titreDe(10), "Dresseur");
  assert.equal(titreDe(15), "Éleveur");
  assert.equal(titreDe(20), "Topdresseur");
  assert.equal(titreDe(30), "Topdresseur", "sans camp, on reste Topdresseur");
  assert.equal(titreDe(25, "ligue"), "Ranger");
  assert.equal(titreDe(34, "ligue"), "Champion d'Arène");
  assert.equal(titreDe(49, "ligue"), "Conseil des 4");
  assert.equal(titreDe(50, "ligue"), "Maître de la Ligue");
  assert.equal(titreDe(25, "rocket"), "Recrue");
  assert.equal(titreDe(30, "rocket"), "Voleur de Pokémon");
  assert.equal(titreDe(50, "rocket"), "Boss de la Team Rocket");
  assert.equal(titreDe(24, "rocket"), "Topdresseur", "le camp ne change rien avant 25");
  assert.equal(TITRES_CAMP.ligue.length, 6); assert.equal(TITRES_CAMP.rocket.length, 6);
  assert.deepEqual(Object.keys(CAMPS), ["ligue", "rocket"]);
});

test("les 50 niveaux : atteints, actuel, et les deux camps à partir de 25", () => {
  const l = listeNiveaux(27, "rocket");
  assert.equal(l.length, 50);
  assert.deepEqual([l[0].n, l[49].n], [1, 50]);
  assert.equal(l.filter((x) => x.atteint).length, 27);
  assert.equal(l.find((x) => x.actuel).n, 27);
  assert.equal(l[23].titre, "Topdresseur");
  assert.deepEqual(l[24].camps, { ligue: "Ranger", rocket: "Recrue" });
  assert.equal(l[24].monCamp, "rocket");
  assert.ok(l[24].nouveauTitre && l[29].nouveauTitre && !l[25].nouveauTitre);
  assert.equal(listeNiveaux(1).filter((x) => x.atteint).length, 1);
});

test("barre d'XP et texte « 340 / 460 XP » (valeurs du serveur)", () => {
  assert.equal(pctXp(340, 460), (340 / 460) * 100);
  assert.equal(pctXp(0, 100), 0);
  assert.equal(pctXp(5, null), 100, "niveau 50 : barre pleine");
  assert.equal(pctXp(999, 100), 100);
  assert.equal(texteXp(340, 460), "340 / 460 XP");
  assert.equal(texteXp(1200, 1080), "1 200 / 1 080 XP");
  assert.equal(texteXp(10, null), "Niveau maximum");
});

test("connexion du jour : la date de Paris, pas celle du téléphone", () => {
  assert.equal(jourParis(new Date("2026-11-12T22:30:00Z")), "2026-11-12"); // 23 h 30 à Paris
  assert.equal(jourParis(new Date("2026-11-12T23:30:00Z")), "2026-11-13"); // 0 h 30 à Paris
  assert.equal(jourParis(new Date("2026-07-01T22:30:00Z")), "2026-07-02"); // heure d'été : 0 h 30
  assert.equal(cleConnexion(new Date("2026-11-12T10:00:00Z")), "connexion:2026-11-12");
});

test("source d'XP d'un badge selon sa rareté", () => {
  assert.equal(sourceBadge("bronze"), "badge_bronze");
  assert.equal(sourceBadge("argent"), "badge_argent");
  assert.equal(sourceBadge("holo"), "badge_holo");
  assert.equal(sourceBadge("secret"), "badge_secret");
  assert.equal(sourceBadge("inconnu"), null);
});

test("réponse de gagner_xp : gain, passage de niveau, nouveau titre, choix du camp", () => {
  assert.deepEqual(lireGain({ gagne: 0, raison: "déjà compté" }), { gagne: 0, raison: "déjà compté", niveauSup: false, nouveauTitre: false, choixCamp: false });
  const simple = lireGain({ gagne: 10, xp: 350, niveau: 3, niveau_avant: 3, xp_niveau: 10, xp_suivant: 140, titre: "Apprenti dresseur" });
  assert.deepEqual([simple.gagne, simple.niveauSup, simple.nouveauTitre, simple.choixCamp], [10, false, false, false]);
  const niveau = lireGain({ gagne: 50, xp: 420, niveau: 4, niveau_avant: 3, xp_niveau: 0, xp_suivant: 160, titre: "Apprenti dresseur" });
  assert.deepEqual([niveau.niveauSup, niveau.nouveauTitre], [true, false]);
  const titre = lireGain({ gagne: 50, xp: 600, niveau: 5, niveau_avant: 4, xp_niveau: 20, xp_suivant: 180, titre: "Gamin des hautes herbes" });
  assert.deepEqual([titre.niveauSup, titre.nouveauTitre, titre.titre], [true, true, "Gamin des hautes herbes"]);
  const camp = lireGain({ gagne: 500, xp: 9000, niveau: 25, niveau_avant: 24, xp_niveau: 0, xp_suivant: 580, titre: "Topdresseur" });
  assert.deepEqual([camp.niveauSup, camp.nouveauTitre, camp.choixCamp], [true, false, true]);
  assert.equal(lireGain({ gagne: 10, xp: 9100, niveau: 26, niveau_avant: 25, titre: "Ranger" }, "ligue").choixCamp, false);
  assert.equal(lireGain({ gagne: 10, xp: 9100, niveau: 30, niveau_avant: 29, titre: "Champion d'Arène" }, "ligue").nouveauTitre, true);
  assert.equal(lireGain({ gagne: 20, xp: 20, niveau: 1, xp_niveau: 20, xp_suivant: 100, titre: "Apprenti dresseur" }).niveauSup, false, "niveau_avant absent");
});

test("historique : libellés des gains", () => {
  const nom = (id) => ({ "premier-scan": "Premier scan" })[id] ?? null;
  assert.equal(libelleGain({ source: "connexion", cle: "connexion:2026-11-12" }), "Connexion du jour");
  assert.equal(libelleGain({ source: "scan", cle: "scan:12" }), "Scan d'une carte");
  assert.equal(libelleGain({ source: "scelle", cle: "scelle:4" }), "Produit scellé ajouté");
  assert.equal(libelleGain({ source: "classeur", cle: "classeur:swsh7-3" }), "Carte cochée au Classeur");
  assert.equal(libelleGain({ source: "extension_complete", cle: "ext:swsh7" }), "Extension complétée");
  assert.equal(libelleGain({ source: "badge_bronze", cle: "badge:premier-scan" }, nom), "Badge « Premier scan »");
  assert.equal(libelleGain({ source: "badge_holo", cle: "badge:disparu" }, nom), "Badge débloqué");
  assert.equal(libelleGain({ source: "quete", cle: "q:1" }), "Quête terminée");
});

test("choix du camp : messages d'erreur du serveur en clair", () => {
  assert.match(messageErreurCamp({ message: "le choix du camp se fait au niveau 25" }), /^Le choix du camp s'ouvre au niveau 25/);
  assert.equal(messageErreurCamp({ message: "tu as déjà changé de camp une fois" }), "Tu as déjà utilisé ton changement de camp : ton camp est définitif.");
  assert.match(messageErreurCamp({ name: "TypeError", message: "Failed to fetch" }), /^Pas de connexion à internet/);
  assert.match(messageErreurCamp({ message: "boum" }), /boum/);
});

test("L'Équipage : trié par niveau, puis XP, puis ancienneté", () => {
  const l = trierParNiveau([
    { pseudo: "A", niveau: 3, xp_total: 300, cree_le: "2025-01-01" },
    { pseudo: "B", niveau: 12, xp_total: 2500, cree_le: "2025-03-01" },
    { pseudo: "C", niveau: 3, xp_total: 310, cree_le: "2025-02-01" },
    { pseudo: "D", niveau: 3, xp_total: 310, cree_le: "2024-12-01" },
  ]);
  assert.deepEqual(l.map((x) => x.pseudo), ["B", "D", "C", "A"]);
});

test("code Konami : ↑ ↑ ↓ ↓ ← → ← → B A, majuscules acceptées, une erreur recommence", () => {
  const taper = (touches) => touches.reduce((p, t) => (p === KONAMI.length ? p : avancerKonami(p, t)), 0);
  assert.equal(taper(KONAMI), KONAMI.length);
  assert.equal(taper([...KONAMI.slice(0, 8), "B", "A"]), KONAMI.length);
  assert.equal(taper(["ArrowUp", "ArrowUp", "ArrowUp", ...KONAMI.slice(2)]), KONAMI.length, "un ↑ de trop au début n'empêche rien");
  assert.equal(taper([...KONAMI.slice(0, 5), "x", ...KONAMI.slice(5)]), 0 + (KONAMI.length - 5 > 0 ? avancerKonami(0, "x") : 0));
  assert.notEqual(taper([...KONAMI.slice(0, 5), "x", ...KONAMI.slice(5)]), KONAMI.length);
});
