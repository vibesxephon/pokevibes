/* PokeVibes — photo d'un produit : taille et compression avant l'envoi
   (pur : sans page ni réseau, testé dans tests/image.test.js). */

export const COTE_MAX = 1200;            // côté le plus long, en pixels
export const POIDS_MAX = 1024 * 1024;    // moins de 1 Mo
export const QUALITES = [0.86, 0.78, 0.68, 0.58, 0.48];

// Taille de l'image réduite : le plus grand côté passe à 1200 px au plus, les proportions sont gardées
export function dimensionsReduites(largeur, hauteur, max = COTE_MAX) {
  if (!(largeur > 0) || !(hauteur > 0)) return null;
  const k = Math.min(1, max / Math.max(largeur, hauteur));
  return { largeur: Math.max(1, Math.round(largeur * k)), hauteur: Math.max(1, Math.round(hauteur * k)) };
}

// Chemin du fichier dans le stockage : « <mon membre_id>/<horodatage>.jpg »
export const cheminPhoto = (membreId, maintenant = Date.now()) => `${membreId}/${maintenant}.jpg`;

// Formats que le stockage accepte (le navigateur convertit le reste en JPEG avant l'envoi)
export const estImage = (fichier) => !!fichier && /^image\//.test(fichier.type ?? "");

// Message clair si l'enregistrement de la photo est refusé
export function messageErreurPhoto(erreur) {
  const t = String(erreur?.message ?? erreur ?? "");
  if (/déjà une image|already/i.test(t)) return "Quelqu'un de L'Équipage vient d'ajouter une photo pour ce produit : la voici.";
  if (/non connecté|jwt|auth/i.test(t)) return "Ta connexion a expiré. Reconnecte-toi puis réessaie.";
  if (/payload too large|too large|maximum allowed size/i.test(t)) return "La photo est trop lourde, même après compression. Essaie une autre photo.";
  if (erreur?.name === "TypeError" || /network|load failed/i.test(t)) return "Pas de connexion à internet : la photo n'est pas partie. Réessaie.";
  return `La photo n'a pas pu être enregistrée : ${t}`;
}
