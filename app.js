/* PokeVibes — point d'entrée.
   Chaque domaine vit dans js/ (un module ES par domaine, sans framework ni build) :
   - calculs purs, testés par « node --test » (dossier tests/) : prix.js, progression.js, recherche.js, badges-regles.js, format.js ;
   - modules de la page : collection, classeur, scanner, fiche, équipage, badges-ui, animations, navigation, thème, connexion ;
   - commun.js (utilitaires de page) et etat.js (Supabase et état partagé).
   La configuration des badges est dans badges.js, celle de Supabase dans config.js. */
import { initAnimations } from "./js/animations.js?v=14";
import { initCollection } from "./js/collection.js?v=14";
import { initNavigation } from "./js/navigation.js?v=14";
import { initEquipage } from "./js/equipage.js?v=14";
import { initFiche } from "./js/fiche.js?v=14";
import { initScanner } from "./js/scanner.js?v=14";
import { initClasseur } from "./js/classeur.js?v=14";
import { initBadges } from "./js/badges-ui.js?v=14";
import { initTheme } from "./js/theme.js?v=14";
import { initConnexion } from "./js/connexion.js?v=14";

initAnimations();
initCollection();
initNavigation();
initEquipage();
initFiche();
initScanner();
initClasseur();
initBadges();
initTheme();
initConnexion();

/* Installation (PWA) */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
