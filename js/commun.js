/* PokeVibes — utilitaires communs côté page (sélecteur, préférences du téléphone, tailles d'écran). */
export * from "./format.js?v=16";

export const $ = (s) => document.querySelector(s);
export const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Tailles d'écran : sous 700 px, l'expérience iPhone ne change pas
export const PC = matchMedia("(min-width: 900px)");
export const GRAND_ECRAN = matchMedia("(min-width: 1200px)");
export const SOURIS = matchMedia("(min-width: 700px) and (hover: hover) and (pointer: fine)");

export const lireLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
export const ecrireLocal = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function avecDelai(promesse, ms, quoi) {
  return Promise.race([promesse, new Promise((_, ko) => setTimeout(() => ko(new Error(`${quoi} trop long`)), ms))]);
}
