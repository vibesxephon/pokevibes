/* PokeVibes — Navigation entre les vues et raccourcis clavier. */
import { $ } from "./commun.js?v=16";
import { etat } from "./etat.js?v=16";
import { entreeVue } from "./animations.js?v=16";
import { dessinerCollection } from "./collection.js?v=16";
import { chargerEquipage } from "./equipage.js?v=16";
import { chargerClasseur, dessinerClasseurListe, ouvrirSet } from "./classeur.js?v=16";
import { dessinerMesBadges } from "./badges-ui.js?v=16";
import { dessinerWishlist } from "./wishlist.js?v=16";

/* ================= Navigation : barre du bas et choix du jeu ================= */
export function montrerVue(v) {
  document.querySelectorAll(".nav-item").forEach((x) => x.toggleAttribute("aria-current", x.dataset.vue === v));
  document.querySelector(`.nav-item[data-vue="${v}"]`)?.setAttribute("aria-current", "page");
  $("#vue-collection").hidden = v !== "collection";
  $("#vue-equipage").hidden = v !== "equipage";
  $("#vue-classeur").hidden = v !== "classeur";
  $("#vue-badges").hidden = v !== "badges";
  $("#vue-wishlist").hidden = v !== "wishlist";
  if (v !== "badges") etat.vueAvant = v;
  scrollTo({ top: 0 });
  entreeVue(v);
  if (v === "equipage") chargerEquipage();
  else if (v === "classeur") chargerClasseur().then(() => (etat.setOuvert ? ouvrirSet(etat.setOuvert, true) : dessinerClasseurListe()));
  else if (v === "badges") dessinerMesBadges();
  else if (v === "wishlist") dessinerWishlist();
  else dessinerCollection();
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initNavigation() {
  document.querySelectorAll(".nav-item").forEach((o) => o.addEventListener("click", () => montrerVue(o.dataset.vue)));
  // Raccourcis clavier : « / » cherche, Échap ferme le panneau de la fiche (les fenêtres se ferment déjà avec Échap)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const f = $("#fiche");
      // le panneau ne se ferme que si aucune fenêtre (alerte, ajout, badge) n'est ouverte par-dessus : Échap ferme d'abord celle-ci
      const dessus = [...document.querySelectorAll("dialog[open]")].some((d) => d !== f && d.matches(":modal"));
      if (f.open && f.classList.contains("panneau") && !dessus) { e.preventDefault(); f.close(); }
      return;
    }
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if ($("#deblocage").open) return;
    const visible = (el) => el && el.offsetParent !== null;
    let champ = $("#ajout").open ? $("#recherche-carte") : [$("#recherche"), $("#classeur-recherche")].find(visible);
    if (!$("#ajout").open && !visible(champ)) { montrerVue("collection"); champ = $("#recherche"); }
    if (!champ || (!visible(champ) && !$("#ajout").open)) return;
    e.preventDefault();
    champ.focus(); champ.select?.();
  });
}
