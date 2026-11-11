/* PokeVibes — Navigation entre les vues et raccourcis clavier. */
import { $ } from "./commun.js?v=14";
import { etat } from "./etat.js?v=14";
import { entreeVue } from "./animations.js?v=14";
import { dessinerCollection } from "./collection.js?v=14";
import { chargerEquipage } from "./equipage.js?v=14";
import { chargerClasseur, dessinerClasseurListe, ouvrirSet } from "./classeur.js?v=14";
import { dessinerMesBadges } from "./badges-ui.js?v=14";

/* ================= Navigation : barre du bas et choix du jeu ================= */
export function montrerVue(v) {
  document.querySelectorAll(".nav-item").forEach((x) => x.toggleAttribute("aria-current", x.dataset.vue === v));
  document.querySelector(`.nav-item[data-vue="${v}"]`)?.setAttribute("aria-current", "page");
  $("#vue-collection").hidden = v !== "collection";
  $("#vue-equipage").hidden = v !== "equipage";
  $("#vue-classeur").hidden = v !== "classeur";
  $("#vue-badges").hidden = v !== "badges";
  if (v !== "badges") etat.vueAvant = v;
  scrollTo({ top: 0 });
  entreeVue(v);
  if (v === "equipage") chargerEquipage();
  else if (v === "classeur") chargerClasseur().then(() => (etat.setOuvert ? ouvrirSet(etat.setOuvert, true) : dessinerClasseurListe()));
  else if (v === "badges") dessinerMesBadges();
  else dessinerCollection();
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initNavigation() {
  document.querySelectorAll(".nav-item").forEach((o) => o.addEventListener("click", () => montrerVue(o.dataset.vue)));
  // Raccourcis clavier : « / » cherche, Échap ferme le panneau de la fiche (les fenêtres se ferment déjà avec Échap)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const f = $("#fiche");
      if (f.open && f.classList.contains("panneau") && !$("#ajout").open && !$("#deblocage").open) { e.preventDefault(); f.close(); }
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
