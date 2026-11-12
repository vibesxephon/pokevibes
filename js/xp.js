/* PokeVibes — XP, niveaux de dresseur et camps.
   Le serveur calcule tout (barème, plafonds du jour, niveaux, titres) : le site appelle seulement les RPC
   gagner_xp et choisir_camp, et lit la vue profils_jeu et mes lignes de xp_journal.
   Ici : l'en-tête (pastille de niveau + fine barre), la page profil, le « +10 XP » qui monte près de l'action,
   l'écran de passage de niveau ou de nouveau titre, l'écran « Choisis ton camp » et le code Konami. */
import { BADGES } from "../badges.js?v=17";
import { $, calme, dateCourte, ecrireLocal, esc, lireLocal } from "./commun.js?v=17";
import { etat, sb } from "./etat.js?v=17";
import { animer, animerTitre, EZ, preparerRoll, rythme } from "./animations.js?v=17";
import { CAMPS, KONAMI, NIVEAU_CAMP, TITRES_CAMP, avancerKonami, cleConnexion, libelleGain, lireGain, listeNiveaux, messageErreurCamp, pctXp, sourceBadge, texteXp } from "./niveaux.js?v=17";
import { activerSons, jouer, sonsActifs } from "./sons.js?v=17";
import { fileBadges, majAvatar, message, verifierBadges } from "./badges-ui.js?v=17";

/* ---------- Profil de jeu (vue profils_jeu + changements de camp déjà faits) ---------- */
export async function chargerProfil() {
  const id = etat.moi?.id; if (!id) return;
  try {
    const [p, m] = await Promise.all([
      sb.from("profils_jeu").select("id, pseudo, xp_total, camp, niveau, xp_niveau, xp_suivant, titre").eq("id", id).maybeSingle(),
      sb.from("membres").select("camp_changements").eq("id", id).maybeSingle(),
    ]);
    if (p.error) throw p.error;
    if (p.data) etat.profil = { ...p.data, camp_changements: Number(m.data?.camp_changements) || 0 };
  } catch (e) { console.warn("Niveau indisponible pour l'instant :", e?.message ?? e); }
  majEntete();
  if (!$("#vue-badges").hidden) dessinerProfil();
}

const campDe = (p) => (CAMPS[p?.camp] ? p.camp : null);

export function majEntete() {
  const p = etat.profil;
  $("#niveau-pastille").textContent = p ? `Nv ${p.niveau}` : "Nv –";
  $("#xp-fine").style.width = `${p ? pctXp(p.xp_niveau, p.xp_suivant) : 0}%`;
  document.documentElement.dataset.camp = campDe(p) ?? "";
  majAvatar();
}

// Texte du bouton avatar, lu par VoiceOver
export const resumeNiveau = () => {
  const p = etat.profil; if (!p) return "";
  return `niveau ${p.niveau}, ${p.titre}${campDe(p) ? `, ${CAMPS[p.camp].nom}` : ""}`;
};

/* ---------- Gagner de l'XP ---------- */
// Clés déjà comptées par le serveur (badges, extensions, connexion du jour) : inutile de les renvoyer à chaque vérification
const cleFaits = () => `xp-cles-${etat.moi?.id}`;
let faits = null;
const lesFaits = () => (faits ??= new Set((lireLocal(cleFaits()) ?? "").split("\n").filter(Boolean)));
function memoriser(cle) {
  const f = lesFaits(); if (f.has(cle)) return;
  f.add(cle);
  ecrireLocal(cleFaits(), [...f].slice(-400).join("\n"));
}
const AMEMORISER = /^(badge|ext|connexion):/;
const enCours = new Map();

/* source, cle : voir gagner_xp. Options :
   cible  : élément (ou fonction qui le renvoie) près duquel « +10 XP » apparaît ;
   discret: aucun effet (rattrapage) ; flotter / son : à false pour garder l'écran ou le son d'un autre moment. */
export function gagner(source, cle, { cible = null, discret = false, flotter: montrer = true, son = true } = {}) {
  if (!etat.moi?.id || !cle || !source) return Promise.resolve(null);
  if (lesFaits().has(cle)) return Promise.resolve({ gagne: 0, raison: "déjà compté" });
  if (enCours.has(cle)) return enCours.get(cle);
  const p = (async () => {
    try {
      const { data, error } = await sb.rpc("gagner_xp", { p_source: source, p_cle: cle });
      if (error) { console.warn("XP non comptée :", error.message); return null; }
      const g = lireGain(data, campDe(etat.profil));
      if ((g.gagne || /déjà compté/.test(g.raison)) && AMEMORISER.test(cle)) memoriser(cle);
      if (!g.gagne) return g;
      appliquer(g);
      if (!discret) {
        if (montrer) flotter(`+${g.gagne} XP`, cible);
        if (son) jouer("xp");
        if (g.niveauSup) programmerNiveau(g);
      }
      return g;
    } catch (e) { console.warn("XP non comptée :", e?.message ?? e); return null; }
    finally { enCours.delete(cle); }
  })();
  enCours.set(cle, p);
  return p;
}

// Les réponses arrivent parfois dans le désordre : on garde la plus récente (le plus d'XP)
function appliquer(g) {
  const p = etat.profil;
  if (p && Number(p.xp_total) > g.xp) return;
  etat.profil = { ...(p ?? {}), xp_total: g.xp, niveau: g.niveau, xp_niveau: g.xpNiveau, xp_suivant: g.xpSuivant, titre: g.titre };
  majEntete();
  if (!$("#vue-badges").hidden) { dessinerProfil(); chargerHistorique(); }
}

// « +10 XP » qui monte et s'efface près de l'action (dans la fenêtre ouverte s'il y en a une)
export function flotter(texte, cible) {
  const el0 = typeof cible === "function" ? cible() : cible;
  const dlg = [...document.querySelectorAll("dialog[open]")].at(-1);
  const visible = (x) => x && x.isConnected && x.getClientRects().length && (!dlg || dlg.contains(x));
  const el = visible(el0) ? el0 : dlg ? null : $("#bouton-badges");
  const r = el?.getBoundingClientRect();
  const f = document.createElement("span");
  f.className = "gain-xp"; f.textContent = texte; f.setAttribute("aria-hidden", "true");
  const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top : innerHeight * 0.3;
  f.style.left = `${Math.max(40, Math.min(innerWidth - 40, x))}px`;
  f.style.top = `${Math.max(16, y)}px`;
  (dlg ?? document.body).append(f);
  $("#xp-annonce").textContent = texte.replace("XP", "points d'expérience");
  const fin = () => f.remove();
  if (!f.animate) { setTimeout(fin, 1200); return; }
  const a = calme
    ? f.animate([{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: 1400 })
    : f.animate([
      { opacity: 0, transform: "translate(-50%, 4px) scale(.8)" },
      { opacity: 1, transform: "translate(-50%, -14px) scale(1.08)", offset: .25 },
      { opacity: 1, transform: "translate(-50%, -30px) scale(1)", offset: .7 },
      { opacity: 0, transform: "translate(-50%, -46px) scale(1)" }], { duration: 1300, easing: EZ });
  a.onfinish = fin; a.oncancel = fin;
}

/* ---------- Connexion du jour, rattrapage des badges déjà gagnés ---------- */
export function connexionDuJour() {
  // un peu après l'animation d'ouverture, pour qu'on voie le « +20 XP » ; jamais de son au chargement
  setTimeout(() => gagner("connexion", cleConnexion(), { son: false }), Math.max(0, rythme.debut + 2600 - performance.now()));
}

export async function rattraperBadges() {
  if (!etat.moi?.id || !etat.journalPret) return;
  const cle = `xp-rattrapage-${etat.moi.id}`;
  if (lireLocal(cle)) return;
  let total = 0, n = 0, complet = true;
  for (const id of etat.badges.keys()) {
    const b = BADGES.find((x) => x.id === id), source = b && sourceBadge(b.rarete);
    if (!source) continue;
    const g = await gagner(source, `badge:${id}`, { discret: true });
    if (!g) complet = false;
    else if (g.gagne) { total += g.gagne; n++; }
  }
  if (complet) ecrireLocal(cle, "1");
  const p = etat.profil;
  if (total && p) message(`Tes ${n} badge${n > 1 ? "s" : ""} déjà gagné${n > 1 ? "s" : ""} t'ont rapporté ${new Intl.NumberFormat("fr-FR").format(total).replace(/\s/g, "\u00a0")} XP : te voilà niveau ${p.niveau}, ${p.titre} !`
    + (p.niveau >= NIVEAU_CAMP && !campDe(p) ? " Choisis ton camp dans ton profil." : ""));
}

// Badges gagnés : XP selon la rareté (montrée sur l'écran du badge, pas en « +XP » volant)
export const xpBadges = new Map();
export function gagnerBadges(badges, discret = false) {
  for (const b of badges) {
    const source = sourceBadge(b.rarete); if (!source) continue;
    gagner(source, `badge:${b.id}`, { discret, flotter: false, son: false }).then((g) => {
      if (!g?.gagne) return;
      xpBadges.set(b.id, g.gagne);
      const el = document.querySelector(`#deb-contenu[data-badge="${b.id}"] .deb-xp`);
      if (el) { el.textContent = `+${g.gagne} XP`; el.hidden = false; animer(el, "bouton", 0); }
    });
  }
}

/* ---------- Passage de niveau / nouveau titre (plein écran court) ---------- */
let attente = null;
function programmerNiveau(g) {
  attente = attente
    ? { ...g, avant: Math.min(attente.avant, g.avant), nouveauTitre: attente.nouveauTitre || g.nouveauTitre, choixCamp: attente.choixCamp || g.choixCamp }
    : { ...g };
  tenterNiveau();
}
const occupe = () => ["#ajout", "#deblocage", "#camp", "#niveau"].some((s) => $(s)?.open) || fileBadges.length > 0 || performance.now() - rythme.debut < 2500;
let minuterieNiveau = 0;
function tenterNiveau() {
  clearTimeout(minuterieNiveau);
  if (!attente) return;
  if (occupe()) { minuterieNiveau = setTimeout(tenterNiveau, 500); return; }
  const g = attente; attente = null;
  montrerNiveau(g);
}

export function montrerNiveau(g) {
  const d = $("#niveau"), c = $("#niv-contenu"), p = etat.profil ?? {};
  const titre = g.nouveauTitre, pct = pctXp(p.xp_niveau ?? g.xpNiveau, p.xp_suivant ?? g.xpSuivant);
  c.innerHTML = `
    <p class="deb-statut">${titre ? "Nouveau titre" : "Niveau supérieur"}</p>
    <div class="niv-nombre${titre ? " petit" : ""}" aria-hidden="true"><span>Niveau</span><strong>${g.niveau}</strong></div>
    <h2 id="niv-titre" class="${titre ? "niv-grand-titre" : "sr-only"}">${titre ? esc(g.titre) : `Niveau ${g.niveau}`}</h2>
    ${titre ? "" : `<p class="niv-sous">${esc(g.titre)}</p>`}
    <div class="niv-barre" aria-hidden="true"><span style="width:${pct}%"></span></div>
    <p class="niv-xp">${texteXp(p.xp_niveau ?? g.xpNiveau, p.xp_suivant ?? g.xpSuivant)}</p>
    <form method="dialog"><button class="bouton-principal" autofocus>${g.choixCamp ? "Choisir mon camp" : "Continuer"}</button></form>`;
  c.dataset.choixCamp = g.choixCamp ? "1" : "";
  preparerRoll(c.querySelector(".bouton-principal"));
  d.showModal();
  jouer("niveau");
  rythme.debut = performance.now();
  const nombre = c.querySelector(".niv-nombre"), barre = c.querySelector(".niv-barre span");
  if (calme) {
    [".deb-statut", ".niv-nombre", "h2", ".niv-sous", ".niv-barre", ".niv-xp", "form"].forEach((s) => animer(c.querySelector(s), "bloc", 0));
  } else {
    nombre.animate([{ transform: "scale(.4)", opacity: 0, filter: "blur(8px)" }, { transform: "scale(1.12)", opacity: 1, filter: "blur(0)", offset: .6 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 900, easing: EZ, fill: "backwards" });
    // légère secousse quand le chiffre se pose
    c.animate([{ transform: "none" }, { transform: "translate(-6px, 2px)" }, { transform: "translate(5px, -3px)" }, { transform: "translate(-4px, 1px)" }, { transform: "translate(2px, 0)" }, { transform: "none" }],
      { duration: 380, delay: 520, easing: "ease-out" });
    barre.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 1100, delay: 650, easing: EZ, fill: "backwards" });
    animer(c.querySelector(".deb-statut"), "bloc", 0);
    if (titre) animerTitre(c.querySelector("h2"), 700);
    [".niv-sous", ".niv-xp", "form"].forEach((s, i) => animer(c.querySelector(s), "bloc", 800 + i * 120));
  }
  // écran court : il se referme seul après un simple passage de niveau
  clearTimeout(d._fin);
  if (!titre && !g.choixCamp) d._fin = setTimeout(() => { if (d.open) d.close(); }, 4200);
}

/* ---------- Choisis ton camp ---------- */
const titresCamp = (camp) => `<ol class="camp-titres">${TITRES_CAMP[camp].map((t) => `<li><span>${t.de === t.a ? t.de : `${t.de}–${t.a}`}</span>${esc(t.titre)}</li>`).join("")}</ol>`;

export function ouvrirCamp() {
  const p = etat.profil; if (!p) return;
  const d = $("#camp"), c = $("#camp-contenu"), actuel = campDe(p), changement = !!actuel;
  const restant = Math.max(0, 1 - (Number(p.camp_changements) || 0));
  c.innerHTML = `
    <h2 id="camp-titre" tabindex="-1">${changement ? "Changer de camp" : "Choisis ton camp"}</h2>
    <p class="camp-intro">${changement
      ? `${restant} changement restant. Après, ton camp sera définitif.`
      : `Niveau ${NIVEAU_CAMP} : ta route se sépare en deux. Ton camp décide de tes 6 prochains titres.`}</p>
    <div class="camp-cartes">${Object.values(CAMPS).map((k) => `
      <button type="button" class="camp-carte camp-${k.id}" data-camp="${k.id}" ${k.id === actuel ? 'aria-disabled="true"' : ""} aria-describedby="camp-avert">
        <span class="camp-embleme" aria-hidden="true">${k.emoji}</span>
        <span class="camp-nom">${esc(k.nom)}</span>
        ${k.id === actuel ? `<span class="camp-actuel">Ton camp actuel</span>` : ""}
        <span class="camp-phrase">${esc(k.phrase)}</span>
        ${titresCamp(k.id)}
      </button>`).join("")}</div>
    <p class="camp-avertissement" id="camp-avert">${changement ? "C'est ton seul changement : tu ne pourras plus revenir." : "Tu pourras changer une seule fois."}</p>
    <div class="camp-confirmer" id="camp-confirmer" hidden>
      <p id="camp-question"></p>
      <div><button type="button" class="bouton-principal" id="camp-oui"></button>
      <button type="button" class="lien-discret" id="camp-non">Annuler</button></div>
    </div>
    <p class="message" id="camp-message" role="status"></p>
    <form method="dialog"><button class="lien-discret camp-plus-tard">${changement ? "Fermer" : "Plus tard"}</button></form>`;
  d.showModal();
  c.querySelector("h2").focus(); // le focus sur le titre : aucun camp n'a l'air choisi d'avance
  rythme.debut = performance.now();
  animerTitre(c.querySelector("h2"), 0);
  animer(c.querySelector(".camp-intro"), "bloc", 250);
  c.querySelectorAll(".camp-carte").forEach((x, i) => animer(x, "carte", 400 + i * 160));
  animer(c.querySelector(".camp-avertissement"), "bloc", 800);
  animer(c.querySelector("form"), "bloc", 900);
  if (!changement && etat.moi) ecrireLocal(`camp-propose-${etat.moi.id}`, "1");
}

function demanderCamp(camp) {
  const p = etat.profil, k = CAMPS[camp]; if (!p || !k || camp === campDe(p)) return;
  const changement = !!campDe(p);
  $("#camp-question").textContent = changement
    ? `Passer à la ${k.nom} ? C'est ton seul changement : ensuite, ton camp sera définitif.`
    : `Rejoindre la ${k.nom} ? Ton titre deviendra « ${TITRES_CAMP[camp][0].titre} ».`;
  const oui = $("#camp-oui");
  oui.textContent = changement ? `Oui, passer à la ${k.nom}` : `Rejoindre la ${k.nom}`;
  oui.dataset.camp = camp; oui.classList.remove("roll"); preparerRoll(oui);
  document.querySelectorAll(".camp-carte").forEach((x) => x.classList.toggle("choisie", x.dataset.camp === camp));
  $("#camp-confirmer").hidden = false; $("#camp-message").textContent = "";
  animer($("#camp-confirmer"), "bloc", 0);
  oui.focus();
}

async function confirmerCamp(camp) {
  const oui = $("#camp-oui"), msg = $("#camp-message");
  oui.disabled = true; oui.setAttribute("aria-busy", "true");
  // la requête de supabase-js est « thenable » mais n'a pas toujours .catch : on passe par then(ok, ko)
  const { data, error } = await sb.rpc("choisir_camp", { p_camp: camp }).then((r) => r, (e) => ({ error: e }));
  oui.disabled = false; oui.removeAttribute("aria-busy");
  if (error) { msg.textContent = messageErreurCamp(error); msg.classList.add("erreur"); return; }
  msg.classList.remove("erreur");
  await chargerProfil();
  const k = CAMPS[camp], titre = data?.titre ?? etat.profil?.titre ?? "";
  const c = $("#camp-contenu");
  c.innerHTML = `
    <div class="camp-bravo camp-${camp}">
      <span class="camp-embleme grand" aria-hidden="true">${k.emoji}</span>
      <p class="deb-statut">Bienvenue dans la</p>
      <h2 id="camp-titre">${esc(k.nom)}</h2>
      <p class="camp-intro">Ton titre : <strong>${esc(titre)}</strong>.${data?.changements_restants === 0 ? " Ton camp est maintenant définitif." : " Tu pourras changer une seule fois depuis ton profil."}</p>
      <form method="dialog"><button class="bouton-principal" autofocus>Continuer</button></form>
    </div>`;
  preparerRoll(c.querySelector(".bouton-principal"));
  c.querySelector(".bouton-principal").focus();
  jouer("camp");
  rythme.debut = performance.now();
  if (!calme) c.querySelector(".camp-embleme").animate([{ transform: "scale(.3) rotate(-20deg)", opacity: 0 }, { transform: "scale(1.15) rotate(4deg)", opacity: 1, offset: .6 }, { transform: "none", opacity: 1 }],
    { duration: 900, easing: EZ, fill: "backwards" });
  else animer(c.querySelector(".camp-embleme"), "bloc", 0);
  animerTitre(c.querySelector("h2"), 300);
  animer(c.querySelector(".camp-intro"), "bloc", 700);
  animer(c.querySelector("form"), "bloc", 850);
}

// À l'ouverture : niveau 25 atteint sans camp (par exemple grâce au rattrapage) → l'écran est proposé une fois
export function proposerCampSiBesoin() {
  const p = etat.profil;
  if (!p || p.niveau < NIVEAU_CAMP || campDe(p) || lireLocal(`camp-propose-${etat.moi?.id}`)) return;
  const essayer = () => (occupe() ? setTimeout(essayer, 800) : ouvrirCamp());
  setTimeout(essayer, 3200);
}

/* ---------- Page profil : niveau, titre, camp, barre, sons, historique, les 50 niveaux ---------- */
export function dessinerProfil() {
  const p = etat.profil, vue = $("#vue-badges");
  vue.dataset.camp = campDe(p) ?? "";
  if (!p) { $("#jeu-titre").textContent = "Niveau indisponible pour l'instant"; return; }
  const camp = campDe(p), k = CAMPS[camp];
  $("#jeu-niveau").textContent = p.niveau;
  $("#jeu-titre").textContent = p.titre;
  $("#jeu-titre-lu").textContent = `Niveau ${p.niveau}, `;
  $("#jeu-camp").innerHTML = k ? `<span aria-hidden="true">${k.emoji}</span> ${esc(k.nom)}` : p.niveau >= NIVEAU_CAMP ? "Sans camp pour l'instant" : `Choix du camp au niveau ${NIVEAU_CAMP}`;
  const pct = pctXp(p.xp_niveau, p.xp_suivant);
  $("#jeu-barre").style.width = `${pct}%`;
  $("#jeu-barre-zone").setAttribute("aria-valuenow", String(Math.round(pct)));
  $("#jeu-barre-zone").setAttribute("aria-valuetext", `${texteXp(p.xp_niveau, p.xp_suivant)}, ${p.xp_total} XP au total`);
  $("#jeu-xp").innerHTML = `<strong>${texteXp(p.xp_niveau, p.xp_suivant)}</strong> <span>· ${new Intl.NumberFormat("fr-FR").format(p.xp_total ?? 0).replace(/\s/g, "\u00a0")} XP au total</span>`;
  const restant = Math.max(0, 1 - (Number(p.camp_changements) || 0));
  const bouton = $("#bouton-camp"), note = $("#camp-note");
  bouton.hidden = !(p.niveau >= NIVEAU_CAMP && (!camp || restant > 0));
  bouton.textContent = camp ? `Changer de camp — ${restant} changement restant` : "Choisir mon camp";
  bouton.classList.toggle("mini-plein", !camp);
  note.textContent = camp && !restant ? "Camp définitif : tu as déjà utilisé ton changement." : p.niveau < NIVEAU_CAMP ? `Le choix du camp s'ouvre au niveau ${NIVEAU_CAMP}.` : "";
  note.hidden = !note.textContent;
  majBoutonSon();
  $("#niveaux-liste").innerHTML = listeNiveaux(p.niveau, camp).map((l) => `<li class="${l.atteint ? "atteint" : ""}${l.actuel ? " actuel" : ""}${l.nouveauTitre ? " palier" : ""}"${l.actuel ? ' aria-current="step"' : ""}>
      <span class="niv-n">${l.n}</span>${l.titre ? `<span class="niv-t">${esc(l.titre)}</span>`
        : `<span class="niv-t niv-ligue${camp === "rocket" ? " autre" : ""}"><span aria-hidden="true">🏆</span> ${esc(l.camps.ligue)}</span><span class="niv-t niv-rocket${camp === "ligue" ? " autre" : ""}"><span aria-hidden="true">🚀</span> ${esc(l.camps.rocket)}</span>`}
      <span class="sr-only">${l.actuel ? " (ton niveau)" : l.atteint ? " (atteint)" : " (pas encore atteint)"}</span></li>`).join("");
}

export function majBoutonSon() {
  const b = $("#bouton-son"), oui = sonsActifs();
  b.setAttribute("aria-pressed", String(oui));
  b.querySelector(".son-etat").textContent = oui ? "activés" : "coupés";
}

export async function chargerHistorique() {
  const id = etat.moi?.id, ul = $("#xp-historique"); if (!id) return;
  const { data, error } = await sb.from("xp_journal").select("source, points, cle, le").eq("membre_id", id).order("le", { ascending: false }).limit(15)
    .then((r) => r, (e) => ({ error: e }));
  if (error) { ul.innerHTML = `<li class="vide">L'historique n'a pas pu être chargé.</li>`; return; }
  const nom = (bid) => BADGES.find((b) => b.id === bid)?.nom ?? null;
  ul.innerHTML = (data ?? []).map((l) => `<li><span class="xp-quoi">${esc(libelleGain(l, nom))}</span><span class="xp-quand">${dateCourte(l.le)}</span><strong class="xp-pts">+${Number(l.points) || 0} XP</strong></li>`).join("")
    || `<li class="vide">Pas encore d'XP : scanne une carte ou coche-la au Classeur pour commencer.</li>`;
}

/* ---------- Code Konami : petite surprise arcade + badge secret ---------- */
export function surpriseKonami() {
  jouer("konami");
  const hote = [...document.querySelectorAll("dialog[open]")].at(-1) ?? document.body;
  const s = document.createElement("div");
  s.className = "konami"; s.setAttribute("aria-hidden", "true");
  const couleurs = ["#F2C200", "#A8F0FF", "#E3B6FF", "#7BD88F", "#FF8A7A"];
  s.innerHTML = `<div class="konami-bandeau"><span>Code secret</span><strong>Mode arcade</strong></div>`
    + (calme ? "" : Array.from({ length: 36 }, (_, i) => `<i style="--c:${couleurs[i % 5]}"></i>`).join(""));
  hote.append(s);
  $("#xp-annonce").textContent = "Code secret trouvé : mode arcade !";
  const fin = () => s.remove();
  if (calme || !s.animate) { s.animate?.([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 2200 }); setTimeout(fin, 2300); }
  else {
    s.querySelector(".konami-bandeau").animate([{ transform: "translate(-50%, -50%) scale(.2) rotate(-8deg)", opacity: 0 }, { transform: "translate(-50%, -50%) scale(1.15) rotate(2deg)", opacity: 1, offset: .2 },
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1, offset: .8 }, { transform: "translate(-50%, -50%) scale(.9)", opacity: 0 }], { duration: 2400, easing: EZ, fill: "both" });
    // des pixels jaillissent du centre en spirale (angle d'or), chacun à sa distance
    s.querySelectorAll("i").forEach((p, i) => {
      const a = (i * 137.5) % 360, dist = 120 + (i * 53) % 220;
      p.animate([
        { transform: `translate(-50%, -50%) rotate(${a}deg) translateX(0) scale(.4)`, opacity: 1 },
        { transform: `translate(-50%, -50%) rotate(${a}deg) translateX(${dist}px) scale(1)`, opacity: 1, offset: .6 },
        { transform: `translate(-50%, -50%) rotate(${a}deg) translateX(${Math.round(dist * 1.15)}px) scale(.6)`, opacity: 0 }],
        { duration: 1500, delay: (i % 6) * 40, easing: EZ, fill: "both" });
    });
    setTimeout(fin, 2500);
  }
  if (etat.moi?.id) {
    ecrireLocal(`konami-${etat.moi.id}`, "1");
    verifierBadges();
  }
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initXp() {
  $("#niveau").addEventListener("close", () => {
    clearTimeout($("#niveau")._fin);
    if ($("#niv-contenu").dataset.choixCamp) setTimeout(ouvrirCamp, 300);
  });
  $("#bouton-camp").addEventListener("click", ouvrirCamp);
  $("#camp-contenu").addEventListener("click", (e) => {
    const carte = e.target.closest(".camp-carte");
    if (carte) { if (carte.getAttribute("aria-disabled") !== "true") demanderCamp(carte.dataset.camp); return; }
    if (e.target.closest("#camp-oui")) confirmerCamp(e.target.closest("#camp-oui").dataset.camp);
    if (e.target.closest("#camp-non")) {
      $("#camp-confirmer").hidden = true;
      document.querySelectorAll(".camp-carte").forEach((x) => x.classList.remove("choisie"));
      document.querySelector(".camp-carte:not([aria-disabled])")?.focus();
    }
  });
  $("#bouton-son").addEventListener("click", () => { activerSons(!sonsActifs()); majBoutonSon(); });
  // Une nouvelle journée commence pendant que l'appli est ouverte
  document.addEventListener("visibilitychange", () => { if (!document.hidden && etat.moi && etat.profil) gagner("connexion", cleConnexion(), { son: false }); });
  let pos = 0;
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) { pos = 0; return; }
    pos = avancerKonami(pos, e.key);
    if (pos === KONAMI.length) { pos = 0; surpriseKonami(); }
  });
}
