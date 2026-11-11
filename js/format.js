/* PokeVibes — mise en forme et petits outils purs (sans page ni réseau : utilisables dans les tests). */

export const NOM_JEU = { pokemon: "Pokémon", onepiece: "One Piece" };

export const euro = (v, dec = 2) => v == null ? "?" : Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: dec, maximumFractionDigits: dec });
export const pct = (v) => v == null ? "" : `${v > 0 ? "+" : ""}${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Texte simplifié pour comparer : minuscules, sans accents, mots séparés par un espace
export const sansAccent = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Numéro de carte comparable : « 007 » → « 7 », « tg05 » → « TG5 »
export const cleNum = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, "").replace(/^([A-Z]*)0*(\d+)$/, "$1$2");

export const jourLocal = (d) => new Date(d).toLocaleDateString("fr-CA"); // AAAA-MM-JJ, à l'heure du téléphone
export const dateLongue = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
export const dateCourte = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
