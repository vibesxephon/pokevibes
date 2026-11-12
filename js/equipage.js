/* PokeVibes — L'Équipage : les membres triés par niveau (niveau, titre, camp, badges).
   Les collections restent privées : aucune carte ni valeur des autres n'est affichée. */
import { $, esc, dateLongue } from "./commun.js?v=17";
import { etat, sb } from "./etat.js?v=17";
import { aAnimer, animerListe } from "./animations.js?v=17";
import { badgesDesMembres, resumeBadges } from "./badges-ui.js?v=17";
import { CAMPS, trierParNiveau } from "./niveaux.js?v=17";

export async function chargerEquipage() {
  const [profils, membres, badgesMembres] = await Promise.all([
    sb.from("profils_jeu").select("id, pseudo, cree_le, xp_total, camp, niveau, titre"),
    sb.from("membres").select("id, pseudo, avatar_url, cree_le"),
    badgesDesMembres(),
  ]);
  // La liste part des membres ; la vue des niveaux la complète (sans elle, les membres s'affichent quand même)
  if (membres.error && profils.error) { $("#membres").innerHTML = `<li class="vide">L'Équipage n'a pas pu être chargé : ${esc(membres.error.message)}</li>`; return; }
  const niveaux = new Map((profils.error ? [] : profils.data ?? []).map((p) => [p.id, p]));
  const lignes = membres.error ? [...niveaux.values()] : (membres.data ?? []).map((m) => ({ ...m, ...niveaux.get(m.id), avatar_url: m.avatar_url }));
  const avatar = new Map(lignes.map((m) => [m.id, m.avatar_url]));
  const liste = trierParNiveau(lignes);
  $("#membres").innerHTML = liste.map((m) => {
    const moi = m.id === etat.moi?.id, badges = badgesMembres.get(m.pseudo) ?? [], camp = CAMPS[m.camp];
    const initiale = (m.pseudo ?? "?").trim().charAt(0).toUpperCase() || "?", url = avatar.get(m.id);
    return `<li class="membre${moi ? " moi" : ""}${camp ? ` camp-${camp.id}` : ""}">
      <span class="membre-initiale" aria-hidden="true">${url ? `<img src="${esc(url)}" alt="">` : esc(initiale)}</span>
      <span class="membre-texte"><span class="pseudo">${esc(m.pseudo)}${moi ? ` <span class="infos">(toi)</span>` : ""}</span>
        ${m.niveau != null ? `<span class="membre-niveau"><span class="niveau-pastille">Nv ${Number(m.niveau)}</span> <span class="membre-titre">${esc(m.titre ?? "")}</span></span>` : ""}
        ${camp ? `<span class="membre-camp"><span aria-hidden="true">${camp.emoji}</span> ${esc(camp.nom)}</span>` : ""}
        <span class="infos">${m.cree_le ? `Dans L'Équipage depuis le ${dateLongue(m.cree_le).replace(" ", " ")}` : "Membre de L'Équipage"}</span>
        ${badges.length ? resumeBadges(badges) : `<span class="infos">Pas encore de badge</span>`}</span>
    </li>`;
  }).join("") || `<li class="vide">Personne pour l'instant. Partage le lien du site et le code d'invitation à L'Équipage.</li>`;
  if (aAnimer.delete("equipage")) animerListe($("#membres").children, 400, 120, "bloc");
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initEquipage() {}
