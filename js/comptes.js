/* PokeVibes — comptes : vérification des formulaires et messages d'erreur en français
   (pur : sans page ni réseau, testé dans tests/comptes.test.js). */

export const MOT_DE_PASSE_MIN = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Vérifie le formulaire avant l'envoi. Renvoie { champ, message } pour la première erreur, ou null.
export function verifierInscription({ pseudo = "", email = "", motDePasse = "", code = "" }) {
  if (!pseudo.trim()) return { champ: "pseudo", message: "Choisis un pseudo : c'est le nom que L'Équipage verra." };
  if (pseudo.trim().length > 24) return { champ: "pseudo", message: "Ton pseudo doit faire 24 caractères au plus." };
  return verifierEmail(email) ?? verifierMotDePasse(motDePasse)
    ?? (code.trim() ? null : { champ: "code", message: "Indique le code d'invitation. Demande-le à Clem." });
}

export function verifierConnexion({ email = "", motDePasse = "" }) {
  return verifierEmail(email) ?? (motDePasse ? null : { champ: "mot-de-passe", message: "Indique ton mot de passe." });
}

export function verifierEmail(email = "") {
  if (!email.trim()) return { champ: "email", message: "Indique ton e-mail." };
  if (!EMAIL.test(email.trim())) return { champ: "email", message: "Cet e-mail n'est pas valide. Vérifie qu'il ressemble à prenom@exemple.fr." };
  return null;
}

export function verifierMotDePasse(motDePasse = "", confirmation) {
  if (motDePasse.length < MOT_DE_PASSE_MIN) return { champ: "mot-de-passe", message: `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.` };
  if (confirmation !== undefined && confirmation !== motDePasse) return { champ: "confirmation", message: "Les deux mots de passe ne sont pas identiques." };
  return null;
}

/* Erreur renvoyée par Supabase → phrase claire.
   quand : « inscription », « connexion », « lien » (lien par e-mail) ou « mot-de-passe » (profil). */
export function messageErreur(erreur, quand = "connexion") {
  if (!erreur) return "";
  const code = String(erreur.code ?? ""), texte = String(erreur.message ?? erreur);
  const a = (re) => re.test(texte);
  // Le code d'invitation est vérifié par la base au moment de créer le membre
  if (a(/code_invitation_invalide/) || (a(/database error saving new user/i) || code === "unexpected_failure")) {
    return quand === "lien"
      ? "Cet e-mail n'a pas encore de compte. Crée-le dans l'onglet « Créer un compte » avec le code d'invitation."
      : "Ce code d'invitation n'est pas bon. Demande-le à Clem.";
  }
  // Réseau coupé : le navigateur lève une TypeError, que supabase-js range en « AuthRetryableFetchError » sans code HTTP
  // (attention : supabase-js range aussi les erreurs 500 du serveur sous ce nom, avec leur code HTTP)
  if (erreur.name === "TypeError" || (erreur.name === "AuthRetryableFetchError" && !erreur.status) || a(/networkerror|network request failed|load failed/i)) {
    return "Pas de connexion à internet. Vérifie ton réseau et réessaie.";
  }
  if (code === "user_already_exists" || code === "email_exists" || a(/already registered|already exists/i)) {
    return "Un compte existe déjà avec cet e-mail. Connecte-toi dans l'onglet « Se connecter ».";
  }
  if (code === "invalid_credentials" || a(/invalid login credentials/i)) {
    return "E-mail ou mot de passe incorrect. Si tu te connectais jusqu'ici avec un lien par e-mail, demande un lien ci-dessous puis choisis ton mot de passe dans ton profil.";
  }
  if (code === "same_password" || a(/different from the old/i)) return "C'est déjà ton mot de passe actuel. Choisis-en un nouveau.";
  if (code === "weak_password" || a(/password should be|password.*(short|least|weak)/i)) return `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`;
  if (code === "email_address_invalid" || a(/email.*invalid|invalid.*email/i)) return "Cet e-mail n'est pas valide. Vérifie qu'il ressemble à prenom@exemple.fr.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || a(/rate limit|too many/i)) return "Trop d'essais d'un coup. Attends quelques minutes puis réessaie.";
  if (code === "session_not_found" || code === "reauthentication_needed" || a(/session|jwt/i)) return "Ta connexion a expiré. Déconnecte-toi puis reconnecte-toi.";
  if (code === "signup_disabled" || a(/signups not allowed/i)) return "Les inscriptions sont fermées pour l'instant. Demande à Clem.";
  return `Ça n'a pas marché : ${texte}`;
}

// L'Équipage : moi d'abord, puis les membres dans l'ordre d'arrivée
export function trierMembres(membres, moiId) {
  return [...(membres ?? [])].sort((a, b) => (b.id === moiId) - (a.id === moiId) || String(a.cree_le ?? "9").localeCompare(String(b.cree_le ?? "9")) || String(a.pseudo).localeCompare(String(b.pseudo), "fr"));
}
