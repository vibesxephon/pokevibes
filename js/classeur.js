/* PokeVibes — Classeur : remplir ses extensions carte par carte. */
import { $, esc, euro, sansAccent } from "./commun.js?v=17";
import { ajout, etat, sb } from "./etat.js?v=17";
import { ouvrirFiche } from "./fiche.js?v=17";
import { depuisCatalogue } from "./cartes.js?v=17";
import { compteSet, destinationConseillee } from "./progression.js?v=17";
import { chargerIndex, prixConnus } from "./catalogue.js?v=17";
import { aAnimer, animerListe, ecrireTitre, entreeBlocs, entreeVue, rythme } from "./animations.js?v=17";
import { verifierBadges } from "./badges-ui.js?v=17";
import { gagner } from "./xp.js?v=17";

export function marquerDestination(d, aide) {
  ajout.destination = d;
  $("#aj-destination").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === d)));
  if (aide !== undefined) $("#aj-destination-aide").textContent = aide;
  const cl = d === "classeur";
  $("#aj-prix").closest("div").hidden = cl;
  $("#bloc-etat").hidden = cl || ajout.type !== "carte";
}

export function proposerDestination(rarete, prix) {
  if (ajout.destManuelle) return;
  const r = destinationConseillee(rarete, prix);
  marquerDestination(r.destination, r.aide);
}

export async function chargerClasseur() {
  if (!etat.moi) return;
  const { data } = await sb.from("classeur").select("tcgdex_id, set_id, quantite").eq("membre_id", etat.moi.id);
  etat.classeur = new Map((data ?? []).map((x) => [x.tcgdex_id, x]));
}

export function ligneSet(idx, sid) {
  const k = compteSet(idx, sid, etat.classeur);
  return `<li><button type="button" class="set" data-set="${esc(sid)}"${sid === etat.setOuvert ? ' aria-current="true"' : ""}>
    <span class="set-nom">${esc(k.set?.nom ?? sid)}</span>
    <span class="set-compte">${k.normales}/${k.off}${k.secretes ? ` <small>+${k.secretes} secrètes</small>` : ""}</span>
    <span class="barre-prog" aria-hidden="true"><span style="width:${k.pct}%"></span></span></button></li>`;
}

export async function dessinerClasseurListe() {
  etat.setOuvert = null; marquerSetOuvert();
  $("#classeur-set").hidden = true; $("#classeur-liste").hidden = false;
  let idx;
  try { idx = await chargerIndex(); }
  catch { $("#classeur-sets").innerHTML = `<li class="vide">Le catalogue des cartes n'a pas pu être chargé. Réessaie dans un instant.</li>`; return; }
  const sids = [...new Set([...etat.classeur.values()].map((x) => x.set_id))]
    .sort((a, b) => (idx.sets.get(b)?.ordre ?? 0) - (idx.sets.get(a)?.ordre ?? 0));
  $("#classeur-sets").innerHTML = sids.length ? sids.map((sid) => ligneSet(idx, sid)).join("")
    : `<li class="vide">Ton classeur est vide. Ouvre une extension ci-dessus, ou scanne une carte et range-la dans le Classeur.</li>`;
  if (aAnimer.delete("classeur")) animerListe($("#classeur-sets").children, 500, 120, "bloc");
}

export async function ouvrirSet(sid, entree = false) {
  const idx = await chargerIndex();
  if (etat.setOuvert !== sid) { etat.prixSet = new Map(); etat.csFiltre = ""; $("#cs-filtre").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.val === ""))); }
  etat.setOuvert = sid;
  $("#classeur-liste").hidden = true; $("#classeur-set").hidden = false;
  marquerSetOuvert();
  dessinerSet(idx);
  if (entree) {
    rythme.debut = performance.now();
    const t = entreeBlocs($("#classeur-set"));
    animerListe($("#cs-cartes").children, t + 120);
  }
  const ids = idx.cartes.filter((c) => c.set?.id === sid).map((c) => c.id);
  prixConnus(ids).then((m) => {
    if (etat.setOuvert !== sid) return;
    etat.prixSet = m;
    if (etat.csFiltre === "manque") return dessinerSet(idx); // tri par prix : il faut tout redessiner
    $("#cs-cartes").querySelectorAll(".cc").forEach((b) => { const p = m.get(b.dataset.id); b.querySelector(".cc-bas span:last-child").textContent = p ? euro(p.prix) : ""; });
  }).catch(() => {});
}

export function dessinerSet(idx) {
  const k = compteSet(idx, etat.setOuvert, etat.classeur);
  ecrireTitre($("#cs-titre"), k.set?.nom ?? etat.setOuvert);
  $("#cs-barre").style.width = `${k.pct}%`;
  $("#cs-compte").textContent = `${k.normales}/${k.off} cartes (${k.pct} %)${k.nbSec ? ` · secrètes : ${k.secretes}/${k.nbSec}` : ""}`;
  const prix = (c) => Number(etat.prixSet.get(c.id)?.prix ?? -1);
  let l = k.cartes;
  if (etat.csFiltre === "manque") l = l.filter((c) => !etat.classeur.has(c.id)).sort((a, b) => prix(b) - prix(a));
  if (etat.csFiltre === "ai") l = l.filter((c) => etat.classeur.has(c.id));
  $("#cs-cartes").innerHTML = l.length ? l.map((c) => {
    const x = etat.classeur.get(c.id), p = etat.prixSet.get(c.id);
    return `<button type="button" class="cc ${x ? "ai" : "manque"}" data-id="${esc(c.id)}" aria-pressed="${!!x}" aria-label="${esc(c.name)} ${esc(c.localId)}${etat.csMode === "fiche" ? ", voir la fiche" : ""}">
      <span class="cc-img">${c.image ? `<img loading="lazy" src="${esc(c.image)}/low.webp" alt="">` : `<span class="cc-sans">${esc(c.name)}</span>`}</span>
      ${x && x.quantite > 1 ? `<span class="quantite">×${x.quantite}</span>` : ""}
      <span class="cc-bas"><span>${esc(c.localId)}</span><span>${p ? euro(p.prix) : ""}</span></span></button>`;
  }).join("") : `<p class="vide">${etat.csFiltre === "manque" ? "Il ne te manque aucune carte. Bravo !" : "Aucune carte cochée pour l'instant."}</p>`;
}

export function marquerSetOuvert() {
  document.querySelectorAll("#vue-classeur .set").forEach((b) => {
    if (b.dataset.set === etat.setOuvert) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
  });
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initClasseur() {
  $("#aj-destination").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    ajout.destManuelle = true;
    marquerDestination(b.dataset.val, b.dataset.val === "classeur" ? "Tu la ranges dans ton Classeur." : "Tu la ranges dans ta Collection.");
  });
  $("#classeur-recherche").addEventListener("input", async (e) => {
    const q = sansAccent(e.target.value);
    if (q.length < 2) { $("#classeur-trouves").innerHTML = ""; return; }
    const idx = await chargerIndex().catch(() => null); if (!idx) return;
    const sets = [...idx.sets.values()].filter((x) => sansAccent(x.nom).includes(q)).sort((a, b) => b.ordre - a.ordre).slice(0, 12);
    $("#classeur-trouves").innerHTML = sets.length ? sets.map((x) => ligneSet(idx, x.id)).join("") : `<li class="vide">Aucune extension ne correspond.</li>`;
  });
  document.querySelector("#vue-classeur").addEventListener("click", (e) => {
    const b = e.target.closest(".set"); if (b) ouvrirSet(b.dataset.set, true);
  });
  $("#classeur-retour").addEventListener("click", () => {
    $("#classeur-recherche").value = ""; $("#classeur-trouves").innerHTML = "";
    $("#classeur-set").hidden = true; $("#classeur-liste").hidden = false; scrollTo({ top: 0 });
    entreeVue("classeur"); dessinerClasseurListe();
  });
  $("#cs-filtre").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    etat.csFiltre = b.dataset.val;
    $("#cs-filtre").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    dessinerSet(await chargerIndex());
  });
  $("#cs-mode").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    etat.csMode = b.dataset.val;
    $("#cs-mode").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#cs-cartes").classList.toggle("mode-fiche", etat.csMode === "fiche");
  });
  $("#cs-cartes").addEventListener("click", async (e) => {
    const b = e.target.closest(".cc"); if (!b) return;
    if (etat.csMode === "fiche") { // voir la fiche (prix, historique, favori, alerte) sans cocher la carte
      const c = (await chargerIndex()).cartes.find((x) => x.id === b.dataset.id);
      if (c) ouvrirFiche(depuisCatalogue(c));
      return;
    }
    const id = b.dataset.id, x = etat.classeur.get(id), delta = x ? -x.quantite : 1;
    // affichage immédiat, puis enregistrement
    if (x) etat.classeur.delete(id); else etat.classeur.set(id, { tcgdex_id: id, set_id: etat.setOuvert, quantite: 1 });
    const idx = await chargerIndex(); dessinerSet(idx);
    const { error } = await sb.rpc("classeur_modifier", { p_tcgdex_id: id, p_delta: delta });
    if (error) { await chargerClasseur(); dessinerSet(idx); $("#cs-compte").textContent = `Pas enregistré : ${error.message}. Réessaie.`; }
    else {
      verifierBadges();
      // carte cochée : XP une seule fois par carte (la décocher puis la recocher ne rapporte rien de plus)
      if (delta > 0) gagner("classeur", `classeur:${id}`, { cible: () => document.querySelector(`#cs-cartes .cc[data-id="${CSS.escape(id)}"]`) });
    }
  });
}
