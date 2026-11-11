/* PokeVibes — Alertes de prix : la fenêtre « Prévenez-moi quand le prix passe… » et la liste des alertes d'une carte.
   Le site crée, modifie, réactive ou supprime les alertes ; le robot des prix les vérifie à chaque passage,
   publie dans le salon Discord de L'Équipage et désactive l'alerte déclenchée. */
import { $, esc } from "./commun.js?v=16";
import { etat, sb } from "./etat.js?v=16";
import { seuilPropose, alertesDeLaCarte, libelleAlerte, dejaFranchi } from "./suivi.js?v=16";
import { euro } from "./format.js?v=16";
import { animer } from "./animations.js?v=16";
import { verifierBadges } from "./badges-ui.js?v=16";
import { signalerSuivi } from "./wishlist.js?v=16";

let enCours = null; // { carte, alerte (si on modifie), sens, touche (le seuil a été tapé à la main) }

function libelleBouton(b, texte) {
  const a = b.querySelector(".roll-a");
  if (a) { a.textContent = texte; b.querySelector(".roll-b").textContent = texte; } else b.textContent = texte;
}
function marquerSens(sens) {
  enCours.sens = sens;
  $("#alerte-sens").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.val === sens)));
  avis();
}
function avis() {
  const seuil = Number($("#alerte-seuil").value), prix = enCours.carte.prix;
  $("#alerte-avis").textContent = dejaFranchi(enCours.sens, seuil, prix)
    ? `Le prix actuel (${euro(prix)}) est déjà ${enCours.sens === "dessus" ? "au-dessus" : "en dessous"} de ce seuil : l'alerte partira au prochain passage du robot.`
    : "";
}

// Ouvre la fenêtre : nouvelle alerte (seuil proposé à −10 % du prix actuel) ou modification d'une alerte existante
export function ouvrirAlerte(carte, alerte = null) {
  enCours = { carte, alerte, sens: alerte?.sens ?? "dessous", touche: !!alerte };
  $("#alerte-titre").textContent = alerte ? "Modifier l'alerte" : "Alerte de prix";
  $("#alerte-carte").textContent = `${carte.nom}${carte.prix != null ? ` · prix actuel ${euro(carte.prix)}` : " · prix pas encore relevé"}`;
  const propose = alerte ? alerte.seuil : seuilPropose(carte.prix);
  $("#alerte-seuil").value = propose == null ? "" : Number(propose).toFixed(2);
  marquerSens(enCours.sens);
  libelleBouton($("#alerte-valider"), alerte ? "Enregistrer l'alerte" : "Créer l'alerte");
  $("#alerte-message").textContent = "";
  $("#alerte").showModal();
  animer($("#alerte"), "bloc", 0);
  $("#alerte-seuil").focus(); $("#alerte-seuil").select?.();
}

async function enregistrer() {
  const brut = String($("#alerte-seuil").value).replace(",", "."), seuil = Math.round(Number(brut) * 100) / 100;
  if (!(seuil > 0)) { $("#alerte-message").textContent = "Indique un prix en euros, par exemple 18,50."; $("#alerte-seuil").focus(); return; }
  const { carte, alerte, sens } = enCours;
  const bouton = $("#alerte-valider"); bouton.disabled = true;
  try {
    if (alerte) {
      const { error } = await sb.from("alertes").update({ sens, seuil, active: true }).eq("id", alerte.id);
      if (error) throw error;
      Object.assign(alerte, { sens, seuil, active: true });
    } else {
      const ligne = { membre_id: etat.moi.id, produit_id: carte.produit_id ?? null, tcgdex_id: carte.tcgdex_id ?? null, sens, seuil };
      const { data, error } = await sb.from("alertes").insert(ligne).select("id, produit_id, tcgdex_id, sens, seuil, active, declenchee_le, prix_declenchement, cree_le").single();
      if (error) throw error;
      etat.alertes.push({ active: true, declenchee_le: null, prix_declenchement: null, ...ligne, ...(data ?? {}), seuil: Number(data?.seuil ?? seuil) });
    }
    $("#alerte").close();
    signalerSuivi();
    verifierBadges();
    const m = $("#fiche-message");
    if (m) m.textContent = `Alerte ${alerte ? "enregistrée" : "créée"} : ${sens === "dessus" ? "au-dessus de" : "en dessous de"} ${euro(seuil)}. Elle sera publiée dans le salon Discord de L'Équipage.`;
  } catch (e) {
    $("#alerte-message").textContent = `L'alerte n'a pas pu être enregistrée : ${e?.message ?? e}. Réessaie.`;
  } finally { bouton.disabled = false; }
}

/* ---------- Liste des alertes d'une carte (dans la fiche) ---------- */
const CLOCHE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>`;
export function htmlAlertes(carte) {
  const l = alertesDeLaCarte(etat.alertes, carte);
  if (!l.length) return "";
  return `<h3 class="sous-titre-fiche">Tes alertes sur cette carte</h3><ul class="liste-alertes">${l.map((a) => {
    const t = libelleAlerte(a);
    return `<li class="alerte-ligne ${a.active ? "active" : t.declenchee ? "declenchee" : ""}" data-id="${a.id}">
      ${CLOCHE}<span class="alerte-texte"><strong>${esc(t.quand)}</strong><span>${esc(t.etat)}</span></span>
      <span class="alerte-boutons">
        ${a.active ? "" : `<button type="button" class="mini" data-action="reactiver">Réactiver</button>`}
        <button type="button" class="mini" data-action="modifier">Modifier</button>
        <button type="button" class="mini mini-danger" data-action="supprimer" aria-label="Supprimer l'alerte ${esc(t.quand.toLowerCase())}">Supprimer</button>
      </span></li>`;
  }).join("")}</ul>`;
}

// Actions sur la liste (un seul écouteur, posé par la fiche sur son conteneur)
export async function actionAlerte(e, carte) {
  const b = e.target.closest("[data-action]"); if (!b) return;
  const li = b.closest(".alerte-ligne"), a = etat.alertes.find((x) => String(x.id) === li.dataset.id); if (!a) return;
  const action = b.dataset.action, message = $("#fiche-message");
  if (action === "modifier") return ouvrirAlerte(carte, a);
  if (action === "supprimer") { // suppression définitive : on demande confirmation sur place
    li.querySelector(".alerte-boutons").innerHTML = `<span class="alerte-confirme">Supprimer définitivement ?</span>
      <button type="button" class="mini mini-danger" data-action="confirmer">Oui, supprimer</button><button type="button" class="mini" data-action="annuler">Non</button>`;
    li.querySelector('[data-action="annuler"]').focus();
    return;
  }
  if (action === "annuler") return signalerSuivi();
  b.disabled = true;
  const { error } = action === "confirmer" ? await sb.from("alertes").delete().eq("id", a.id) : await sb.from("alertes").update({ active: true }).eq("id", a.id);
  if (error) { b.disabled = false; if (message) message.textContent = `Action impossible : ${error.message}. Réessaie.`; return; }
  if (action === "confirmer") { etat.alertes = etat.alertes.filter((x) => x !== a); if (message) message.textContent = "Alerte supprimée."; }
  else { a.active = true; if (message) message.textContent = `Alerte réactivée : ${a.sens === "dessus" ? "au-dessus de" : "en dessous de"} ${euro(a.seuil)}.`; }
  signalerSuivi();
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initAlertes() {
  $("#alerte-sens").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !enCours) return;
    if (!enCours.touche) { const s = seuilPropose(enCours.carte.prix, b.dataset.val); $("#alerte-seuil").value = s == null ? "" : s.toFixed(2); }
    marquerSens(b.dataset.val);
  });
  $("#alerte-seuil").addEventListener("input", () => { if (enCours) { enCours.touche = true; avis(); } });
  $("#form-alerte").addEventListener("submit", (e) => { e.preventDefault(); enregistrer(); });
}
