/* PokeVibes — Badges : journal d'activité, vérification, déblocage plein écran, page « Mes badges ». */
import { BADGES, RARETES as RARETES_BADGES, FAMILLES, svgBadge } from "../badges.js?v=17";
import { $, calme, dateCourte, dateLongue, ecrireLocal, esc, lireLocal } from "./commun.js?v=17";
import { etat, sb } from "./etat.js?v=17";
import { produitsDesAlertes } from "./wishlist.js?v=17";
import { compterMesPhotos } from "./photo.js?v=17";
import { badgesAGagner, compterSniperPur, donneesBadges, mesurer, ouvertureANoter, progresTexte, statsClasseurPur } from "./badges-regles.js?v=17";
import { chargerIndex } from "./catalogue.js?v=17";
import { aAnimer, animer, EZ, preparerRoll, rythme } from "./animations.js?v=17";
import { montrerVue } from "./navigation.js?v=17";
import { chargerClasseur } from "./classeur.js?v=17";
import { gagner, gagnerBadges, resumeNiveau, xpBadges } from "./xp.js?v=17";
import { jouer } from "./sons.js?v=17";

export async function chargerJournal() {
  etat.journalPret = false;
  try {
    const id = etat.moi?.id; if (!id) return;
    const [a, b, v] = await Promise.all([
      sb.from("activite").select("type, le").eq("membre_id", id).order("le").limit(20000),
      sb.from("badges_obtenus").select("badge_id, obtenu_le").eq("membre_id", id),
      sb.from("ventes").select("quantite, prix_vente, prix_achat, frais").eq("membre_id", id),
    ]);
    if (b.error || a.error) throw b.error ?? a.error; // sans la liste des badges déjà gagnés, on ne décerne rien
    etat.badges = new Map((b.data ?? []).map((x) => [x.badge_id, x.obtenu_le]));
    etat.activite = a.data ?? [];
    etat.ventes = v.error ? [] : (v.data ?? []);
    etat.journalPret = true;
    majAvatar();
    // Une ouverture au plus par heure
    if (ouvertureANoter(etat.activite)) noterActivite("ouverture");
  } catch (e) { console.warn("Badges indisponibles pour l'instant :", e?.message ?? e); }
}

// Renvoie l'identifiant de la ligne créée (il sert de clé unique à l'XP d'un scan)
export async function noterActivite(type, detail = null) {
  if (!etat.moi) return null;
  etat.activite.push({ type, le: new Date().toISOString() });
  let id = null;
  try {
    const { data, error } = await sb.from("activite").insert({ membre_id: etat.moi.id, type, detail }).select("id").maybeSingle();
    if (error) console.warn("Activité non enregistrée :", error.message);
    id = data?.id ?? null;
  } catch (e) { console.warn("Activité non enregistrée :", e?.message ?? e); }
  if (type !== "ouverture") verifierBadges();
  return id;
}

// Statistiques du Classeur (Pokémon) : progression de chaque extension
export async function statsClasseur() {
  if (!etat.classeur.size) return statsClasseurPur(etat.classeur, null);
  try { return statsClasseurPur(etat.classeur, await chargerIndex()); }
  catch { return statsClasseurPur(etat.classeur, null); }
}

// Sniper : prix d'achat au moins 20 % sous le prix du marché le jour de l'achat
export async function compterSniper() {
  const lignes = (etat.lignes ?? []).filter((x) => x.achete_le && Number(x.prix_achat) > 0);
  if (!lignes.length) return 0;
  const cle = lignes.map((x) => `${x.produit_id}@${x.achete_le}`).sort().join(",");
  if (etat.sniperCache?.cle === cle) return etat.sniperCache.n;
  const { data, error } = await sb.from("prix").select("produit_id, le, prix, etat_prix")
    .in("produit_id", [...new Set(lignes.map((x) => x.produit_id))]).eq("valide", true).order("le");
  if (error) return 0;
  const n = compterSniperPur(lignes, data ?? []);
  etat.sniperCache = { cle, n };
  return n;
}

// Vérification : au chargement et après chaque action (regroupée pour ne pas surcharger)
export let minuterieBadges = 0, verifEnCours = false, verifRelance = false;

export function verifierBadges() { clearTimeout(minuterieBadges); minuterieBadges = setTimeout(lancerVerification, 400); }

export async function lancerVerification() {
  if (!etat.moi || !etat.journalPret) return;
  if (verifEnCours) { verifRelance = true; return; }
  verifEnCours = true;
  try {
    await chargerClasseur().catch(() => {});
    const [cl, sniper, produitDe, photos] = await Promise.all([statsClasseur(), compterSniper().catch(() => 0), produitsDesAlertes().catch(() => new Map()), compterMesPhotos()]);
    const d = etat.donnees = donneesBadges({ activite: etat.activite, lignes: etat.lignes ?? [], classeur: cl, sniper, ventes: etat.ventes, creeLe: etat.moi?.cree_le,
      favoris: etat.favoris ?? [], alertes: etat.alertes ?? [], produitDe, photos, konami: lireLocal(`konami-${etat.moi.id}`) === "1" });
    const nouveaux = badgesAGagner(d, etat.badges);
    const cleInit = `badges-init-${etat.moi.id}`;
    const premierLancement = etat.badges.size === 0 && !lireLocal(cleInit);
    if (nouveaux.length) {
      const le = new Date().toISOString();
      const { error } = await sb.from("badges_obtenus")
        .upsert(nouveaux.map((b) => ({ membre_id: etat.moi.id, badge_id: b.id, obtenu_le: le })), { onConflict: "membre_id,badge_id", ignoreDuplicates: true });
      if (error) throw error;
      nouveaux.forEach((b) => etat.badges.set(b.id, le));
      gagnerBadges(nouveaux, premierLancement); // XP selon la rareté (sans effet au premier lancement)
      if (premierLancement) message(`Tu as déjà gagné ${nouveaux.length} badge${nouveaux.length > 1 ? "s" : ""} ! Retrouve-les en touchant ton avatar.`);
      else annoncer(nouveaux);
    }
    // Extension complétée à 100 % : XP une seule fois par extension (la clé l'assure côté serveur)
    for (const sid of cl.completes ?? []) gagner("extension_complete", `ext:${sid}`);
    ecrireLocal(cleInit, "1");
    majAvatar();
    if (!$("#vue-badges").hidden) dessinerMesBadges();
  } catch (e) { console.warn("Vérification des badges reportée :", e?.message ?? e); }
  finally {
    verifEnCours = false;
    if (verifRelance) { verifRelance = false; verifierBadges(); }
  }
}

export function majAvatar() {
  const niveau = resumeNiveau();
  $("#bouton-badges").setAttribute("aria-label", `Mon compte et mes badges : ${niveau ? `${niveau}, ` : ""}${etat.badges.size} badges sur ${BADGES.length}`);
}

// Message bref (premier lancement)
export let minuterieMessage = 0;

export function message(texte) {
  const t = $("#toast");
  t.textContent = texte; t.hidden = false;
  animer(t, "bouton", 0);
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => { t.hidden = true; }, 6000);
}

/* ---------- Déblocage : plein écran, un badge après l'autre ---------- */
export const fileBadges = [];

export function annoncer(badges) {
  fileBadges.push(...[...badges].sort((a, b) => RARETES_BADGES[a.rarete].rang - RARETES_BADGES[b.rarete].rang));
  if ($("#deblocage").open) return;
  // On laisse finir l'animation d'ouverture avant d'interrompre
  setTimeout(badgeSuivant, Math.max(300, rythme.debut + 3000 - performance.now()));
}

export function badgeSuivant() {
  if ($("#deblocage").open) return;
  // Un écran de niveau ou de camp est ouvert : le badge attend qu'il se ferme
  const autre = ["#niveau", "#camp"].map((x) => $(x)).find((d) => d?.open);
  if (autre) { autre.addEventListener("close", () => setTimeout(badgeSuivant, 400), { once: true }); return; }
  // Pas d'interruption pendant un ajout : les badges gagnés attendent que la fenêtre se ferme
  if ($("#ajout").open) { $("#ajout").addEventListener("close", () => setTimeout(badgeSuivant, 400), { once: true }); return; }
  const b = fileBadges.shift();
  if (b) montrerBadge(b, true);
}

export function progres(b) {
  return etat.donnees ? progresTexte(b, etat.donnees) : "";
}

export const masque = (b) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" overflow="visible">${b.dessin}</svg>`)}")`;

export function montrerBadge(b, deblocage = false) {
  const obtenu = etat.badges.get(b.id), cache = b.secret && !obtenu, rarete = RARETES_BADGES[b.rarete];
  const c = $("#deb-contenu");
  c.innerHTML = `
    <div class="deb-badge ${obtenu ? "" : "verrouille"}">
      <div class="deb-svg">${svgBadge(b, { verrouille: cache, label: cache ? "Badge secret" : undefined })}</div>
      ${obtenu && b.rarete === "holo" ? `<span class="reflet" style='--masque:${masque(b)}'></span>` : ""}
    </div>
    <p class="deb-xp" ${deblocage && xpBadges.has(b.id) ? "" : "hidden"}>+${xpBadges.get(b.id) ?? 0} XP</p>
    <p class="deb-statut">${deblocage ? "Nouveau badge débloqué" : obtenu ? `Obtenu le ${dateLongue(obtenu)}` : "Pas encore obtenu"}</p>
    <h2 id="deb-nom">${cache ? "???" : esc(b.nom)}</h2>
    <span class="rarete rarete-${b.rarete}">${rarete.nom} · ${esc(b.famille)}</span>
    <p class="deb-condition">${cache ? "Badge secret : continue d'utiliser PokeVibes pour le découvrir." : esc(b.condition)}</p>
    ${!obtenu && !cache && progres(b) ? `<p class="deb-progres">${progres(b)}</p>` : ""}
    <form method="dialog"><button class="bouton-principal" autofocus>${deblocage ? "Super" : "Fermer"}</button></form>`;
  c.dataset.badge = deblocage ? b.id : "";
  preparerRoll(c.querySelector(".bouton-principal"));
  $("#deblocage").showModal();
  if (deblocage) jouer("badge");
  // Animation de la référence : de petit, penché et flou à un léger rebond, puis taille normale
  rythme.debut = performance.now();
  const badge = c.querySelector(".deb-badge");
  if (calme) animer(badge, "bloc", 0);
  else if (deblocage) badge.animate([
    { transform: "scale(.3) rotate(-25deg)", filter: "blur(6px)", opacity: 0 },
    { transform: "scale(1.18) rotate(4deg)", filter: "blur(0)", opacity: 1, offset: .65 },
    { transform: "scale(1) rotate(0)", opacity: 1 }], { duration: 1100, easing: EZ, fill: "backwards" });
  else animer(badge, "embleme", 0);
  [".deb-statut", ".deb-xp:not([hidden])", "#deb-nom", ".rarete", ".deb-condition", ".deb-progres", "form"].forEach((s, i) => animer(c.querySelector(s), "bloc", (deblocage ? 500 : 150) + i * 110));
}

export function dessinerMesBadges() {
  const n = BADGES.filter((b) => etat.badges.has(b.id)).length;
  $("#badges-nb").textContent = n;
  $("#badges-total").textContent = `/ ${BADGES.length}`;
  $("#badges-barre").style.width = `${(n / BADGES.length) * 100}%`;
  $("#badges-familles").innerHTML = FAMILLES.map((f) => {
    const l = BADGES.filter((b) => b.famille === f); if (!l.length) return "";
    const nf = l.filter((b) => etat.badges.has(b.id)).length;
    return `<section class="famille"><h3 class="sous-titre">${esc(f)} <span>${nf} / ${l.length}</span></h3><div class="grille-badges">${l.map((b) => {
      const obtenu = etat.badges.get(b.id), cache = b.secret && !obtenu, p = progres(b);
      const etatTexte = obtenu ? dateCourte(obtenu) : cache ? "Secret" : p || RARETES_BADGES[b.rarete].nom;
      const pct = !obtenu && b.unite && etat.donnees ? Math.min(100, (mesurer(b, etat.donnees) / b.cible) * 100) : null;
      const lu = cache ? "Badge secret, pas encore découvert"
        : `${b.nom}, ${RARETES_BADGES[b.rarete].nom}, ${obtenu ? `obtenu le ${dateLongue(obtenu)}` : `pas encore obtenu${p ? ` : ${p}` : ""}`}`;
      return `<button type="button" class="badge-item ${obtenu ? "obtenu" : "verrouille"}" data-badge="${b.id}" aria-label="${esc(lu)}">
        <span class="badge-svg" aria-hidden="true">${svgBadge(b, { verrouille: cache })}</span>
        <span class="badge-nom">${cache ? "???" : esc(b.nom)}</span>
        <span class="badge-etat">${esc(etatTexte)}</span>
        ${pct != null && !cache ? `<span class="barre-prog" aria-hidden="true"><span style="width:${pct}%"></span></span>` : ""}
      </button>`;
    }).join("")}</div></section>`;
  }).join("");
  if (aAnimer.delete("badges")) {
    $("#badges-familles").querySelectorAll(".famille h3, .badge-item").forEach((el, i) => animer(el, el.matches("h3") ? "bloc" : "carte", 300 + Math.min(i, 14) * 70));
  }
}

/* ---------- L'Équipage : nombre de badges et les 3 plus rares ---------- */
export async function badgesDesMembres() {
  const parPseudo = new Map();
  try {
    const [o, m] = await Promise.all([sb.from("badges_obtenus").select("membre_id, badge_id, obtenu_le"), sb.from("membres").select("id, pseudo")]);
    if (o.error || m.error) return parPseudo;
    const pseudo = new Map((m.data ?? []).map((x) => [x.id, x.pseudo]));
    for (const x of o.data ?? []) {
      const b = BADGES.find((y) => y.id === x.badge_id), p = pseudo.get(x.membre_id);
      if (!b || !p) continue;
      if (!parPseudo.has(p)) parPseudo.set(p, []);
      parPseudo.get(p).push({ b, le: x.obtenu_le });
    }
  } catch {}
  return parPseudo;
}

export function resumeBadges(l) {
  if (!l?.length) return "";
  const rares = [...l].sort((x, y) => RARETES_BADGES[y.b.rarete].rang - RARETES_BADGES[x.b.rarete].rang || new Date(x.le) - new Date(y.le)).slice(0, 3);
  return `<span class="badges-membre" role="img" aria-label="${l.length} badge${l.length > 1 ? "s" : ""}, dont ${esc(rares.map((x) => x.b.nom).join(", "))}">
    ${rares.map((x) => svgBadge(x.b).replace('role="img"', 'aria-hidden="true"')).join("")}<span class="infos">${l.length} badge${l.length > 1 ? "s" : ""}</span></span>`;
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initBadges() {
  $("#deblocage").addEventListener("close", () => { if (fileBadges.length) setTimeout(badgeSuivant, 350); });
  /* ---------- Page « Mes badges » ---------- */
  $("#bouton-badges").addEventListener("click", () => montrerVue("badges"));
  $("#badges-retour").addEventListener("click", () => montrerVue(etat.vueAvant ?? "collection"));
  $("#badges-familles").addEventListener("click", (e) => {
    const b = e.target.closest(".badge-item"); if (b) montrerBadge(BADGES.find((x) => x.id === b.dataset.badge));
  });
}
