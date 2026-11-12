/* PokeVibes — point d'entrée.
   Chaque domaine vit dans js/ (un module ES par domaine, sans framework ni build) :
   - calculs purs, testés par « node --test » (dossier tests/) : prix.js, progression.js, recherche.js, badges-regles.js, format.js ;
   - calculs purs aussi : suivi.js (Wishlist, alertes, historique), comptes.js (formulaires, erreurs), image.js (photo), niveaux.js (titres, camps) ;
   - modules de la page : collection, classeur, scanner, fiche (+ cartes.js), wishlist, alertes, équipage, badges-ui, animations, navigation, thème, connexion, courbe (bulle des prix), photo, xp (niveaux, camps, Konami), sons ;
   - commun.js (utilitaires de page) et etat.js (Supabase et état partagé).
   La configuration des badges est dans badges.js, celle de Supabase dans config.js. */
import { initAnimations } from "./js/animations.js?v=17";
import { initCollection } from "./js/collection.js?v=17";
import { initNavigation } from "./js/navigation.js?v=17";
import { initEquipage } from "./js/equipage.js?v=17";
import { initFiche } from "./js/fiche.js?v=17";
import { initScanner } from "./js/scanner.js?v=17";
import { initClasseur } from "./js/classeur.js?v=17";
import { initBadges } from "./js/badges-ui.js?v=17";
import { initWishlist } from "./js/wishlist.js?v=17";
import { initAlertes } from "./js/alertes.js?v=17";
import { initTheme } from "./js/theme.js?v=17";
import { initConnexion } from "./js/connexion.js?v=17";
import { initCourbe } from "./js/courbe.js?v=17";
import { initXp } from "./js/xp.js?v=17";
import { initSons } from "./js/sons.js?v=17";

initAnimations();
initCollection();
initNavigation();
initEquipage();
initFiche();
initScanner();
initClasseur();
initBadges();
initWishlist();
initAlertes();
initTheme();
initCourbe();
initSons();
initXp();
initConnexion();

/* Installation (PWA) */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
