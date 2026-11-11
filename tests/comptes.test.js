// Comptes : vérification des formulaires, messages d'erreur en français, ordre des membres.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifierInscription, verifierConnexion, verifierMotDePasse, messageErreur, trierMembres } from "../js/comptes.js";

const ok = { pseudo: "Sam", email: "sam@exemple.fr", motDePasse: "12345678", code: "PIKA" };

test("inscription : pseudo, e-mail, mot de passe de 8 caractères, code", () => {
  assert.equal(verifierInscription(ok), null);
  assert.equal(verifierInscription({ ...ok, pseudo: "  " }).champ, "pseudo");
  assert.equal(verifierInscription({ ...ok, pseudo: "x".repeat(25) }).champ, "pseudo");
  assert.equal(verifierInscription({ ...ok, email: "sam@" }).champ, "email");
  assert.deepEqual(verifierInscription({ ...ok, motDePasse: "1234567" }), { champ: "mot-de-passe", message: "Le mot de passe doit faire au moins 8 caractères." });
  assert.match(verifierInscription({ ...ok, code: "" }).message, /Demande-le à Clem/);
});

test("connexion et changement de mot de passe", () => {
  assert.equal(verifierConnexion({ email: "sam@exemple.fr", motDePasse: "x" }), null);
  assert.equal(verifierConnexion({ email: "", motDePasse: "x" }).champ, "email");
  assert.equal(verifierConnexion({ email: "sam@exemple.fr", motDePasse: "" }).champ, "mot-de-passe");
  assert.equal(verifierMotDePasse("12345678", "12345678"), null);
  assert.equal(verifierMotDePasse("12345678", "12345679").champ, "confirmation");
});

test("erreurs de Supabase traduites en phrases claires", () => {
  const code = { message: "Database error saving new user", code: "unexpected_failure", status: 500 };
  assert.equal(messageErreur(code, "inscription"), "Ce code d'invitation n'est pas bon. Demande-le à Clem.");
  assert.match(messageErreur(code, "lien"), /Créer un compte/); // lien demandé pour un e-mail inconnu
  // forme exacte renvoyée par supabase-js pour le refus du code (erreur 500 de la base)
  const reel = { name: "AuthRetryableFetchError", message: "Database error saving new user", status: 500 };
  assert.equal(messageErreur(reel, "inscription"), "Ce code d'invitation n'est pas bon. Demande-le à Clem.");
  assert.match(messageErreur({ name: "AuthRetryableFetchError", message: "Load failed", status: 0 }), /Pas de connexion à internet/);
  assert.match(messageErreur({ name: "AuthRetryableFetchError", message: "Gateway timeout", status: 504 }), /^Ça n'a pas marché/);
  assert.match(messageErreur({ message: "User already registered", code: "user_already_exists" }), /Un compte existe déjà avec cet e-mail/);
  assert.match(messageErreur({ message: "Invalid login credentials", code: "invalid_credentials" }), /^E-mail ou mot de passe incorrect/);
  assert.equal(messageErreur({ message: "Password should be at least 8 characters.", code: "weak_password" }), "Le mot de passe doit faire au moins 8 caractères.");
  assert.match(messageErreur({ message: "Unable to validate email address: invalid format", code: "email_address_invalid" }), /pas valide/);
  assert.match(messageErreur({ message: "email rate limit exceeded", code: "over_email_send_rate_limit" }), /Attends quelques minutes/);
  assert.match(messageErreur(new TypeError("Failed to fetch")), /Pas de connexion à internet/);
  assert.match(messageErreur({ message: "New password should be different from the old password.", code: "same_password" }), /déjà ton mot de passe/);
  assert.equal(messageErreur({ message: "Bizarre" }), "Ça n'a pas marché : Bizarre");
  assert.equal(messageErreur(null), "");
});

test("L'Équipage : moi d'abord, puis par date d'arrivée", () => {
  const l = trierMembres([{ id: "b", pseudo: "Sam", cree_le: "2025-02-01" }, { id: "c", pseudo: "Lou", cree_le: "2025-01-01" }, { id: "a", pseudo: "Clem", cree_le: "2025-03-01" }], "a");
  assert.deepEqual(l.map((m) => m.pseudo), ["Clem", "Lou", "Sam"]);
});
