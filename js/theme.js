/* PokeVibes — Mode sombre : automatique (réglage du téléphone) ou choisi avec le bouton lune / soleil. */
import { $ } from "./commun.js?v=15";

/* ================= Mode sombre ================= */
export const sombreSysteme = matchMedia("(prefers-color-scheme: dark)");

export const themeActuel = () => document.documentElement.dataset.theme || (sombreSysteme.matches ? "sombre" : "clair");

export function majTheme() {
  const sombre = themeActuel() === "sombre";
  $("#bouton-theme").setAttribute("aria-label", sombre ? "Passer en mode clair" : "Passer en mode sombre");
  document.documentElement.classList.toggle("est-sombre", sombre);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", sombre ? "#121212" : "#F6F6F4");
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initTheme() {
  $("#bouton-theme").addEventListener("click", () => {
    const t = themeActuel() === "sombre" ? "clair" : "sombre";
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("theme", t); } catch {}
    majTheme();
  });
  sombreSysteme.addEventListener?.("change", majTheme);
  majTheme();
}
