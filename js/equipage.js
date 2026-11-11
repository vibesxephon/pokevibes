/* PokeVibes — L'Équipage : les collections de chacun. */
import { $, esc, euro, NOM_JEU } from "./commun.js?v=14";
import { etat, sb } from "./etat.js?v=14";
import { aAnimer, animerListe, entreeCartes, rythme } from "./animations.js?v=14";
import { grouper } from "./collection.js?v=14";
import { badgesDesMembres, resumeBadges } from "./badges-ui.js?v=14";

export async function chargerEquipage() {
  const [{ data, error }, badgesMembres] = await Promise.all([sb.from("vitrine").select("*"), badgesDesMembres()]);
  if (error) { $("#membres").innerHTML = `<li class="vide">L'Équipage n'a pas pu être chargé : ${esc(error.message)}</li>`; return; }
  etat.vitrine = data ?? [];
  const parMembre = new Map();
  for (const x of etat.vitrine) {
    const m = parMembre.get(x.pseudo) ?? { valeur: 0, objets: 0 };
    m.valeur += Number(x.valeur ?? 0); m.objets += x.quantite;
    parMembre.set(x.pseudo, m);
  }
  $("#membres").innerHTML = [...parMembre.entries()].sort((a, b) => b[1].valeur - a[1].valeur).map(([p, m]) => `<li><button data-pseudo="${esc(p)}" aria-pressed="${p === etat.membreChoisi}">
      <span><span class="pseudo">${esc(p)}</span><br><span class="infos">${m.objets} objets</span>${resumeBadges(badgesMembres.get(p))}</span>
      <span class="valeur">${euro(m.valeur, 0)}</span></button></li>`).join("")
    || `<li class="vide">Personne n'a encore de collection. Partage le lien du site à L'Équipage.</li>`;
  if (aAnimer.delete("equipage")) animerListe($("#membres").children, 400, 120, "bloc");
  dessinerVitrine();
}

export function dessinerVitrine() {
  const liste = etat.vitrine.filter((x) => x.pseudo === etat.membreChoisi);
  $("#vitrine").innerHTML = !etat.membreChoisi ? "" : ["pokemon", "onepiece"].map((j) => {
    const l = liste.filter((x) => x.jeu === j);
    return l.length ? `<h3 class="titre-jeu">Collection ${NOM_JEU[j]}</h3>${grouper(l, false)}` : "";
  }).join("");
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initEquipage() {
  $("#membres").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    etat.membreChoisi = etat.membreChoisi === b.dataset.pseudo ? null : b.dataset.pseudo;
    document.querySelectorAll("#membres button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.pseudo === etat.membreChoisi)));
    dessinerVitrine();
    rythme.debut = performance.now(); entreeCartes($("#vitrine"), 0);
  });
}
