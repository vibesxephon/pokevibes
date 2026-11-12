/* PokeVibes — comptes : connexion (e-mail + mot de passe, ou lien par e-mail), création de compte sur invitation,
   mot de passe du profil, puis chargement de l'appli. */
import { $ } from "./commun.js?v=17";
import { etat, sb } from "./etat.js?v=17";
import { entreeApp, entreeConnexion, animer } from "./animations.js?v=17";
import { chargerCollection } from "./collection.js?v=17";
import { chargerJournal, verifierBadges } from "./badges-ui.js?v=17";
import { chargerSuivi } from "./wishlist.js?v=17";
import { chargerProfil, connexionDuJour, proposerCampSiBesoin, rattraperBadges } from "./xp.js?v=17";
import { messageErreur, verifierConnexion, verifierInscription, verifierEmail, verifierMotDePasse } from "./comptes.js?v=17";

export let charge = false;

export async function afficher(session) {
  const connexionCachee = $("#ecran-connexion").hidden;
  $("#ecran-connexion").hidden = !!session;
  $("#app").hidden = !session;
  if (!session) { if (connexionCachee) entreeConnexion(); charge = false; etat.moi = null; etat.profil = null; return; }
  if (charge) return;
  charge = true;
  entreeApp();
  const { data: moi } = await sb.from("membres").select("id, pseudo, avatar_url, cree_le").eq("auth_id", session.user.id).maybeSingle();
  etat.moi = moi;
  etat.email = session.user.email ?? "";
  const pseudo = moi?.pseudo ?? "toi", initiale = (moi?.pseudo ?? "?").trim().charAt(0).toUpperCase() || "?";
  $("#mon-pseudo").textContent = pseudo;
  $("#profil-nom").textContent = moi?.pseudo ?? "";
  $("#initiale").textContent = initiale;
  $("#compte-initiale").textContent = initiale;
  $("#compte-titre").textContent = moi?.pseudo ?? "Mon compte";
  $("#compte-email").textContent = etat.email;
  $("#mdp-identifiant").value = etat.email;
  await Promise.all([chargerCollection(), chargerJournal(), chargerSuivi(), chargerProfil()]);
  connexionDuJour();
  // Premier lancement de la v17 : les badges déjà obtenus rapportent leur XP (sans animation, un seul message)
  await rattraperBadges();
  verifierBadges();
  proposerCampSiBesoin();
}

/* ---------- Petits outils de formulaire ---------- */
function signaler(form, erreur, msg) {
  form.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
  msg.classList.toggle("erreur", !!erreur);
  if (!erreur) return false;
  msg.textContent = erreur.message;
  const champ = form.querySelector(`[data-champ="${erreur.champ}"]`);
  if (champ) { champ.setAttribute("aria-invalid", "true"); champ.focus(); }
  return true;
}
const occupe = (form, oui, texte) => {
  const b = form.querySelector('[type="submit"]');
  b.disabled = oui; b.setAttribute("aria-busy", String(oui));
  const libelle = b.querySelector(".roll-a") ?? b;
  if (oui) { b.dataset.libelle = libelle.textContent; libelle.textContent = texte; }
  else if (b.dataset.libelle) { libelle.textContent = b.dataset.libelle; b.querySelector(".roll-b")?.replaceChildren(b.dataset.libelle); }
};

function montrerOnglet(nom, focus = true) {
  const inscription = nom === "inscription";
  $("#onglet-connexion").setAttribute("aria-selected", String(!inscription));
  $("#onglet-inscription").setAttribute("aria-selected", String(inscription));
  $("#onglet-connexion").tabIndex = inscription ? -1 : 0;
  $("#onglet-inscription").tabIndex = inscription ? 0 : -1;
  $("#form-connexion").hidden = inscription;
  $("#form-inscription").hidden = !inscription;
  const form = inscription ? $("#form-inscription") : $("#form-connexion");
  animer(form, "bloc", 0);
  if (focus) (inscription ? $("#onglet-inscription") : $("#onglet-connexion")).focus();
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initConnexion() {
  // Repères des champs pour placer le focus sur celui qui pose problème
  for (const [id, champ] of [["email", "email"], ["mot-de-passe", "mot-de-passe"], ["ins-pseudo", "pseudo"], ["ins-email", "email"],
    ["ins-mot-de-passe", "mot-de-passe"], ["ins-code", "code"], ["mdp-nouveau", "mot-de-passe"], ["mdp-confirmation", "confirmation"]]) $(`#${id}`).dataset.champ = champ;

  /* ---------- Onglets « Se connecter » / « Créer un compte » ---------- */
  $("#onglet-connexion").addEventListener("click", () => montrerOnglet("connexion", false));
  $("#onglet-inscription").addEventListener("click", () => montrerOnglet("inscription", false));
  $(".onglets").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const versInscription = e.key === "End" || ((e.key === "ArrowRight" || e.key === "ArrowLeft") && $("#onglet-connexion").getAttribute("aria-selected") === "true");
    montrerOnglet(versInscription ? "inscription" : "connexion");
  });
  // L'e-mail tapé suit d'un onglet à l'autre
  $("#email").addEventListener("input", () => { $("#ins-email").value = $("#email").value; });
  $("#ins-email").addEventListener("input", () => { $("#email").value = $("#ins-email").value; });

  /* ---------- Se connecter ---------- */
  $("#form-connexion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget, msg = $("#connexion-message");
    const email = $("#email").value.trim(), motDePasse = $("#mot-de-passe").value;
    if (signaler(form, verifierConnexion({ email, motDePasse }), msg)) return;
    occupe(form, true, "Connexion…"); msg.textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email, password: motDePasse }).catch((x) => ({ error: x }));
    occupe(form, false);
    if (error) { const texte = messageErreur(error, "connexion"); signaler(form, { champ: /n'est pas valide/.test(texte) ? "email" : "mot-de-passe", message: texte }, msg); }
  });
  $("#oubli").addEventListener("click", () => {
    const t = $("#oubli-texte"), ouvert = t.hidden;
    t.hidden = !ouvert; $("#oubli").setAttribute("aria-expanded", String(ouvert));
    if (ouvert) animer(t, "bloc", 0);
  });
  // Option discrète : la connexion par lien, comme avant
  $("#lien-email").addEventListener("click", async () => {
    const form = $("#form-connexion"), msg = $("#connexion-message"), email = $("#email").value.trim();
    if (signaler(form, verifierEmail(email), msg)) return;
    msg.textContent = "Envoi du lien…";
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }).catch((x) => ({ error: x }));
    if (error) { signaler(form, { champ: "email", message: messageErreur(error, "lien") }, msg); return; }
    msg.textContent = `Lien envoyé à ${email}. Ouvre-le sur cet appareil pour te connecter.`;
  });

  /* ---------- Créer un compte (sur invitation) ---------- */
  $("#form-inscription").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget, msg = $("#inscription-message");
    const v = { pseudo: $("#ins-pseudo").value.trim(), email: $("#ins-email").value.trim(), motDePasse: $("#ins-mot-de-passe").value, code: $("#ins-code").value.trim() };
    if (signaler(form, verifierInscription(v), msg)) return;
    occupe(form, true, "Création du compte…"); msg.textContent = "";
    const { data, error } = await sb.auth.signUp({ email: v.email, password: v.motDePasse, options: { data: { pseudo: v.pseudo, code: v.code } } }).catch((x) => ({ error: x }));
    occupe(form, false);
    if (error) {
      const texte = messageErreur(error, "inscription");
      signaler(form, { champ: /code d'invitation/.test(texte) ? "code" : /mot de passe/.test(texte) ? "mot-de-passe" : "email", message: texte }, msg);
      return;
    }
    // E-mail déjà inscrit (Supabase renvoie alors un compte sans identité, sans le dire)
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      signaler(form, { champ: "email", message: messageErreur({ code: "user_already_exists" }) }, msg); return;
    }
    if (!data?.session) { msg.textContent = "Compte créé. Connecte-toi dans l'onglet « Se connecter »."; montrerOnglet("connexion"); return; }
    msg.textContent = "Compte créé, bienvenue dans L'Équipage !";
  });

  /* ---------- Profil : définir / changer mon mot de passe ---------- */
  $("#bouton-mdp").addEventListener("click", () => {
    const f = $("#form-mdp"), ouvrir = f.hidden;
    f.hidden = !ouvrir; $("#bouton-mdp").setAttribute("aria-expanded", String(ouvrir));
    if (ouvrir) { animer(f, "bloc", 0); $("#mdp-nouveau").focus(); }
  });
  $("#form-mdp").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget, msg = $("#mdp-message"), mdp = $("#mdp-nouveau").value;
    if (signaler(form, verifierMotDePasse(mdp, $("#mdp-confirmation").value), msg)) return;
    occupe(form, true, "Enregistrement…"); msg.textContent = "";
    const { error } = await sb.auth.updateUser({ password: mdp }).catch((x) => ({ error: x }));
    occupe(form, false);
    if (error) { signaler(form, { champ: "mot-de-passe", message: messageErreur(error, "mot-de-passe") }, msg); return; }
    form.reset();
    msg.textContent = "Mot de passe enregistré. Tu peux maintenant te connecter avec ton e-mail et ce mot de passe.";
  });

  $("#deconnexion").addEventListener("click", () => sb.auth.signOut());
  sb.auth.onAuthStateChange((_e, session) => afficher(session));
  sb.auth.getSession().then(({ data }) => afficher(data.session));
}
