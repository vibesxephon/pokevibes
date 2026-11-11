/* PokeVibes — L'Équipage : la liste des membres (pseudo, initiale, date d'arrivée, badges).
   Les collections restent privées : aucune carte ni valeur des autres n'est affichée. */
import { $, esc, dateLongue } from "./commun.js?v=16";
import { etat, sb } from "./etat.js?v=16";
import { aAnimer, animerListe } from "./animations.js?v=16";
import { badgesDesMembres, resumeBadges } from "./badges-ui.js?v=16";
import { trierMembres } from "./comptes.js?v=16";

export async function chargerEquipage() {
  const [{ data, error }, badgesMembres] = await Promise.all([sb.from("membres").select("id, pseudo, avatar_url, cree_le"), badgesDesMembres()]);
  if (error) { $("#membres").innerHTML = `<li class="vide">L'Équipage n'a pas pu être chargé : ${esc(error.message)}</li>`; return; }
  const membres = trierMembres(data ?? [], etat.moi?.id);
  $("#membres").innerHTML = membres.map((m) => {
    const moi = m.id === etat.moi?.id, badges = badgesMembres.get(m.pseudo) ?? [];
    const initiale = (m.pseudo ?? "?").trim().charAt(0).toUpperCase() || "?";
    return `<li class="membre${moi ? " moi" : ""}">
      <span class="membre-initiale" aria-hidden="true">${m.avatar_url ? `<img src="${esc(m.avatar_url)}" alt="">` : esc(initiale)}</span>
      <span class="membre-texte"><span class="pseudo">${esc(m.pseudo)}${moi ? ` <span class="infos">(toi)</span>` : ""}</span>
        <span class="infos">${m.cree_le ? `Dans L'Équipage depuis le ${dateLongue(m.cree_le).replace(" ", " ")}` : "Membre de L'Équipage"}</span>
        ${badges.length ? resumeBadges(badges) : `<span class="infos">Pas encore de badge</span>`}</span>
    </li>`;
  }).join("") || `<li class="vide">Personne pour l'instant. Partage le lien du site et le code d'invitation à L'Équipage.</li>`;
  if (aAnimer.delete("equipage")) animerListe($("#membres").children, 400, 120, "bloc");
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initEquipage() {}
