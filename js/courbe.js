/* PokeVibes — courbe des prix interactive : repère vertical, point et bulle « 9 nov. 2026 · 45,00 € ».
   Toucher ou cliquer (et survoler à la souris) montre le relevé le plus proche ; glisser le doigt fait suivre
   la bulle ; flèches gauche / droite (Début / Fin) au clavier. La bulle reste dans l'écran sur les bords.
   Un seul jeu d'écouteurs pour toutes les courbes, même dessinées plus tard (période changée, autre fiche). */
import { pointProche, placerBulle, texteBulle } from "./prix.js?v=17";

const releves = (zone) => { try { return JSON.parse(zone.dataset.releves).map(([x, y, le, prix]) => ({ x, y, le, prix })); } catch { return []; } };

// Affiche le relevé n° i de la courbe
export function montrerReleve(zone, i) {
  const l = releves(zone); if (!l.length) return;
  i = Math.max(0, Math.min(l.length - 1, i));
  const p = l[i], L = zone.clientWidth, H = zone.clientHeight, x = p.x * L, y = p.y * H;
  const bulle = zone.querySelector(".graphe-bulle"), texte = texteBulle(p);
  zone.dataset.index = i;
  zone.classList.add("lecture");
  zone.querySelector(".graphe-repere").style.transform = `translateX(${x}px)`;
  zone.querySelector(".graphe-curseur").style.transform = `translate(${x}px, ${y}px)`;
  if (bulle.textContent !== texte) bulle.textContent = texte;
  bulle.style.transform = `translateX(${placerBulle(x, bulle.offsetWidth, L)}px)`;
  zone.setAttribute("aria-valuenow", String(i + 1));
  zone.setAttribute("aria-valuetext", texte);
}

export function cacherReleve(zone) { zone?.classList.remove("lecture"); }

const zoneDe = (e) => e.target.closest?.(".graphe-zone[data-releves]");
const versIndex = (zone, e) => {
  const r = zone.getBoundingClientRect();
  return pointProche(releves(zone), (e.clientX - r.left) / Math.max(1, r.width));
};

export function initCourbe() {
  let suivie = null; // courbe sous le doigt ou le bouton de la souris
  document.addEventListener("pointerdown", (e) => {
    const zone = zoneDe(e);
    // Toucher ailleurs referme la bulle des courbes lues au doigt
    document.querySelectorAll(".graphe-zone.lecture").forEach((z) => { if (z !== zone && z !== document.activeElement) cacherReleve(z); });
    if (!zone || e.button > 0) return;
    suivie = zone;
    montrerReleve(zone, versIndex(zone, e));
  });
  document.addEventListener("pointermove", (e) => {
    if (suivie) { montrerReleve(suivie, versIndex(suivie, e)); return; }
    if (e.pointerType !== "mouse") return;
    const zone = zoneDe(e);
    if (zone) montrerReleve(zone, versIndex(zone, e));
  }, { passive: true });
  const relacher = () => { suivie = null; };
  document.addEventListener("pointerup", relacher);
  document.addEventListener("pointercancel", (e) => { if (suivie && e.pointerType !== "mouse") cacherReleve(suivie); relacher(); });
  // Souris qui quitte la courbe : la bulle s'en va (sauf si la courbe a le focus clavier)
  document.addEventListener("pointerout", (e) => {
    const zone = zoneDe(e);
    if (zone && e.pointerType === "mouse" && !zone.contains(e.relatedTarget) && zone !== document.activeElement && !suivie) cacherReleve(zone);
  });
  document.addEventListener("keydown", (e) => {
    const zone = zoneDe(e); if (!zone) return;
    const n = releves(zone).length, i = zone.classList.contains("lecture") ? Number(zone.dataset.index ?? n - 1) : n - 1;
    const cible = { ArrowLeft: i - 1, ArrowDown: i - 1, ArrowRight: i + 1, ArrowUp: i + 1, Home: 0, End: n - 1, PageUp: i + 7, PageDown: i - 7 }[e.key];
    if (cible === undefined) return;
    e.preventDefault();
    montrerReleve(zone, zone.classList.contains("lecture") ? cible : n - 1);
  });
  document.addEventListener("focusin", (e) => { const zone = zoneDe(e); if (zone && !zone.classList.contains("lecture")) montrerReleve(zone, releves(zone).length - 1); });
  document.addEventListener("focusout", (e) => { const zone = zoneDe(e); if (zone) cacherReleve(zone); });
}
