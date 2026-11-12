/* PokeVibes — niveaux de dresseur, titres et camps : textes et petites règles d'affichage (calculs purs, testés par node).
   L'XP elle-même n'est JAMAIS calculée ici : le serveur (RPC gagner_xp, vue profils_jeu) donne le total, le niveau,
   l'XP dans le niveau et le titre. Ce module ne fait que mettre en forme ce que le serveur renvoie. */

export const NIVEAU_MAX = 50, NIVEAU_CAMP = 25;

export const CAMPS = {
  ligue: { id: "ligue", nom: "Ligue Pokémon", emoji: "🏆", phrase: "Monter les arènes une à une, jusqu'au sommet de la Ligue." },
  rocket: { id: "rocket", nom: "Team Rocket", emoji: "🚀", phrase: "Agir dans l'ombre, grimper les rangs, devenir le Boss." },
};

// Titres par tranche de niveaux (les mêmes que la fonction titre_niveau du serveur)
export const TITRES_COMMUNS = [
  { de: 1, a: 4, titre: "Apprenti dresseur" },
  { de: 5, a: 9, titre: "Gamin des hautes herbes" },
  { de: 10, a: 14, titre: "Dresseur" },
  { de: 15, a: 19, titre: "Éleveur" },
  { de: 20, a: 24, titre: "Topdresseur" },
];
export const TITRES_CAMP = {
  ligue: [
    { de: 25, a: 29, titre: "Ranger" }, { de: 30, a: 34, titre: "Champion d'Arène" }, { de: 35, a: 39, titre: "Challenger de la Ligue" },
    { de: 40, a: 44, titre: "Finaliste de la Ligue" }, { de: 45, a: 49, titre: "Conseil des 4" }, { de: 50, a: 50, titre: "Maître de la Ligue" },
  ],
  rocket: [
    { de: 25, a: 29, titre: "Recrue" }, { de: 30, a: 34, titre: "Voleur de Pokémon" }, { de: 35, a: 39, titre: "Infiltré" },
    { de: 40, a: 44, titre: "Lieutenant" }, { de: 45, a: 49, titre: "Bras droit du Boss" }, { de: 50, a: 50, titre: "Boss de la Team Rocket" },
  ],
};

const tranche = (l, n) => l.find((t) => n >= t.de && n <= t.a)?.titre;

// Titre d'un niveau pour un camp (sans camp, on reste « Topdresseur » à partir de 20)
export function titreDe(niveau, camp = null) {
  const n = Math.max(1, Math.min(NIVEAU_MAX, Math.floor(Number(niveau) || 1)));
  if (n < NIVEAU_CAMP || !TITRES_CAMP[camp]) return tranche(TITRES_COMMUNS, Math.min(n, 24));
  return tranche(TITRES_CAMP[camp], n);
}

/* Les 50 niveaux pour la page profil : chaque ligne dit le(s) titre(s) et si le niveau est atteint.
   Avant 25 : un titre commun ; à partir de 25 : le titre de chaque camp (celui de l'autre camp reste visible). */
export function listeNiveaux(niveau, camp = null) {
  const actuel = Math.floor(Number(niveau) || 1);
  return Array.from({ length: NIVEAU_MAX }, (_, i) => {
    const n = i + 1, debut = (l) => l.some((t) => t.de === n);
    const ligne = { n, atteint: n <= actuel, actuel: n === actuel, nouveauTitre: n === 1 || debut(TITRES_COMMUNS) || debut(TITRES_CAMP.ligue) };
    if (n < NIVEAU_CAMP) ligne.titre = titreDe(n);
    else ligne.camps = { ligue: titreDe(n, "ligue"), rocket: titreDe(n, "rocket") };
    ligne.monCamp = n >= NIVEAU_CAMP ? camp ?? null : null;
    return ligne;
  });
}

// Remplissage de la barre (0 à 100) à partir de ce que dit le serveur ; niveau 50 : barre pleine
export function pctXp(xpNiveau, xpSuivant) {
  if (xpSuivant == null) return 100;
  const s = Number(xpSuivant), x = Number(xpNiveau) || 0;
  return s > 0 ? Math.max(0, Math.min(100, (x / s) * 100)) : 0;
}

const nb = (n) => new Intl.NumberFormat("fr-FR").format(Number(n) || 0).replace(/\s/g, "\u00a0");

export const texteXp = (xpNiveau, xpSuivant) => (xpSuivant == null ? "Niveau maximum" : `${nb(xpNiveau)} / ${nb(xpSuivant)} XP`);

// Jour à Paris (AAAA-MM-JJ) : la connexion du jour ne rapporte qu'une fois, minuit à Paris
export function jourParis(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export const cleConnexion = (d = new Date()) => `connexion:${jourParis(d)}`;

// Source d'XP d'un badge selon sa rareté
export const sourceBadge = (rarete) => (["bronze", "argent", "holo", "secret"].includes(rarete) ? `badge_${rarete}` : null);

/* Lecture d'une réponse de gagner_xp : { gagne, xp, niveau, niveau_avant, xp_niveau, xp_suivant, titre } ou { gagne: 0, raison }.
   camp : mon camp au moment du gain (pour savoir si le titre a changé avec le niveau). */
export function lireGain(r, camp = null) {
  const gagne = Number(r?.gagne) || 0;
  if (!gagne) return { gagne: 0, raison: r?.raison ?? "", niveauSup: false, nouveauTitre: false, choixCamp: false };
  const niveau = Number(r.niveau), avant = Number(r.niveau_avant ?? r.niveau);
  return {
    gagne, xp: Number(r.xp), niveau, avant, xpNiveau: Number(r.xp_niveau) || 0, xpSuivant: r.xp_suivant ?? null, titre: r.titre ?? titreDe(niveau, camp),
    niveauSup: niveau > avant,
    nouveauTitre: niveau > avant && (r.titre ?? titreDe(niveau, camp)) !== titreDe(avant, camp),
    choixCamp: !camp && avant < NIVEAU_CAMP && niveau >= NIVEAU_CAMP,
  };
}

// Historique : libellé lisible d'une ligne de xp_journal (nomBadge : id → nom du badge)
export function libelleGain(ligne, nomBadge = () => null) {
  const cle = String(ligne?.cle ?? ""), apres = cle.slice(cle.indexOf(":") + 1);
  switch (ligne?.source) {
    case "connexion": return "Connexion du jour";
    case "scan": return "Scan d'une carte";
    case "scelle": return "Produit scellé ajouté";
    case "classeur": return "Carte cochée au Classeur";
    case "extension_complete": return "Extension complétée";
    case "quete": return "Quête terminée";
    case "juste_prix": return "Juste prix";
    case "badge_bronze": case "badge_argent": case "badge_holo": case "badge_secret": {
      const nom = nomBadge(apres);
      return nom ? `Badge « ${nom} »` : "Badge débloqué";
    }
    default: return "XP gagnée";
  }
}

// Messages d'erreur du choix de camp
export function messageErreurCamp(e) {
  const m = String(e?.message ?? e ?? "");
  if (/niveau 25/i.test(m)) return "Le choix du camp s'ouvre au niveau 25. Continue à scanner et à compléter ton Classeur !";
  if (/déjà changé|deja change/i.test(m)) return "Tu as déjà utilisé ton changement de camp : ton camp est définitif.";
  if (/non connecté/i.test(m)) return "Ta session a expiré : reconnecte-toi, puis réessaie.";
  if (e?.name === "TypeError" || /network|failed to|réseau/i.test(m)) return "Pas de connexion à internet. Réessaie dans un instant.";
  return `Le camp n'a pas pu être enregistré : ${m || "erreur inconnue"}.`;
}

// L'Équipage : par niveau (puis XP totale, puis ancienneté)
export function trierParNiveau(profils) {
  return [...(profils ?? [])].sort((a, b) => (Number(b.niveau) || 0) - (Number(a.niveau) || 0)
    || (Number(b.xp_total) || 0) - (Number(a.xp_total) || 0)
    || String(a.cree_le ?? "").localeCompare(String(b.cree_le ?? "")));
}

/* Code Konami : ↑ ↑ ↓ ↓ ← → ← → B A. avancerKonami(position, touche) → nouvelle position ;
   la position vaut KONAMI.length quand le code est complet. */
export const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
export function avancerKonami(pos, touche) {
  const t = String(touche ?? "").length === 1 ? String(touche).toLowerCase() : String(touche ?? "");
  if (t === KONAMI[pos]) return pos + 1;
  return t === KONAMI[0] ? (pos >= 2 && KONAMI[pos] === "ArrowDown" ? pos : 1) : 0; // « ↑ ↑ ↑ » garde la suite ↑ ↑
}
