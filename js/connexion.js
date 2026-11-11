/* PokeVibes — Connexion (lien magique) et chargement de l'appli. */
import { $ } from "./commun.js?v=15";
import { etat, sb } from "./etat.js?v=15";
import { entreeApp, entreeConnexion } from "./animations.js?v=15";
import { chargerCollection } from "./collection.js?v=15";
import { chargerJournal, verifierBadges } from "./badges-ui.js?v=15";
import { chargerSuivi } from "./wishlist.js?v=15";

export let charge = false;

export async function afficher(session) {
  const connexionCachee = $("#ecran-connexion").hidden;
  $("#ecran-connexion").hidden = !!session;
  $("#app").hidden = !session;
  if (!session) { if (connexionCachee) entreeConnexion(); charge = false; return; }
  if (charge) return;
  charge = true;
  entreeApp();
  const { data: moi } = await sb.from("membres").select("id, pseudo, cree_le").eq("auth_id", session.user.id).maybeSingle();
  etat.moi = moi;
  $("#mon-pseudo").textContent = moi?.pseudo ?? "toi";
  $("#profil-nom").textContent = moi?.pseudo ?? "";
  $("#initiale").textContent = (moi?.pseudo ?? "?").trim().charAt(0).toUpperCase() || "?";
  await Promise.all([chargerCollection(), chargerJournal(), chargerSuivi()]);
  verifierBadges();
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initConnexion() {
  /* ================= Connexion ================= */
  $("#form-connexion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim(), pseudo = $("#pseudo").value.trim(), msg = $("#connexion-message");
    msg.textContent = "Envoi du lien…";
    const { error } = await sb.auth.signInWithOtp({
      email, options: { emailRedirectTo: location.origin + location.pathname, data: pseudo ? { pseudo } : undefined },
    });
    msg.textContent = error ? `Le lien n'a pas pu être envoyé : ${error.message}` : `Lien envoyé à ${email}. Ouvre-le sur cet appareil pour te connecter.`;
  });
  $("#deconnexion").addEventListener("click", () => sb.auth.signOut());
  sb.auth.onAuthStateChange((_e, session) => afficher(session));
  sb.auth.getSession().then(({ data }) => afficher(data.session));
}
