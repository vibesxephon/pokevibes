/* PokeVibes — sons arcade : petits airs chiptune composés ici et joués en Web Audio (aucun fichier son).
   Coupés par défaut ; le bouton du profil les active (réglage mémorisé). Jamais de son au chargement :
   rien ne joue avant que la personne ait touché l'écran ou une touche. */
import { lireLocal, ecrireLocal } from "./commun.js?v=17";

const CLE = "sons";
let ctx = null, interaction = false;

export const sonsActifs = () => lireLocal(CLE) === "1";
export function activerSons(oui) { ecrireLocal(CLE, oui ? "1" : "0"); if (oui) jouer("activer"); }

// Fréquence d'une note (A4 = 440 Hz) : « C5 », « G#6 »…
const NOTES = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };
const freq = (n) => { const m = n.match(/^([A-G]#?)(\d)$/); return 440 * 2 ** ((NOTES[m[1]] + (Number(m[2]) - 4) * 12) / 12); };

// [note, durée en s, forme d'onde] ; null = silence
const AIRS = {
  activer: [["E6", .05, "square"], ["A6", .07, "square"]],
  xp: [["B5", .045, "square"], ["E6", .045, "square"], ["B6", .09, "square"]],
  badge: [["G5", .07, "triangle"], ["C6", .07, "triangle"], ["E6", .07, "triangle"], ["G6", .07, "triangle"], ["C7", .22, "triangle"]],
  niveau: [["C5", .08, "square"], ["E5", .08, "square"], ["G5", .08, "square"], ["C6", .08, "square"], [null, .04], ["G5", .07, "square"], ["C6", .3, "square"]],
  camp: [["D5", .1, "square"], ["A5", .1, "square"], ["D6", .1, "square"], ["F#6", .32, "triangle"]],
  konami: [["C6", .05, "square"], ["D6", .05, "square"], ["E6", .05, "square"], ["G6", .05, "square"], ["A6", .05, "square"], ["C7", .05, "square"], [null, .05], ["C7", .05, "square"], ["G7", .25, "square"]],
};

export function jouer(nom) {
  if (!sonsActifs() || !interaction || !AIRS[nom]) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const general = ctx.createGain(); general.gain.value = 0.07; general.connect(ctx.destination);
    let t = ctx.currentTime + 0.02;
    for (const [note, duree, onde] of AIRS[nom]) {
      if (note) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = onde; o.frequency.value = freq(note);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.008);
        g.gain.setValueAtTime(1, t + duree * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
        o.connect(g); g.connect(general); o.start(t); o.stop(t + duree + 0.02);
      }
      t += duree;
    }
  } catch {}
}

export function initSons() {
  const marquer = () => { interaction = true; };
  addEventListener("pointerdown", marquer, { once: true, capture: true });
  addEventListener("keydown", marquer, { once: true, capture: true });
}
