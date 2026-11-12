/* PokeVibes — connexion à Supabase et état partagé entre les modules. */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "../config.js?v=17";

export { SUPABASE_URL, SUPABASE_KEY };
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const etat = {
  moi: null, email: "", toutes: [], lignes: [], jeu: "pokemon", categorie: "", recherche: "", tri: "extension",
  extensions: [], sets: null, vueAvant: "collection",
  // Classeur
  classeur: new Map(), setOuvert: null, csFiltre: "", prixSet: new Map(),
  // Badges
  badges: new Map(), activite: [], ventes: [], journalPret: false, donnees: null, sniperCache: null,
  // Wishlist et alertes de prix
  favoris: [], alertes: [], suiviPret: false, csMode: "cocher",
  // XP et niveau (vue profils_jeu) : calculés par le serveur
  profil: null,
};

// Fenêtre d'ajout (scan, recherche, choix de la destination)
export const ajout = { type: "carte", choix: null };
