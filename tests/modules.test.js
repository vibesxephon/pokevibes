// Structure du site : imports valides, une seule version partout, service worker complet.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");
const FICHIERS = ["app.js", "badges.js", "config.js", ...fs.readdirSync(path.join(RACINE, "js")).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`)];
const VERSION = lire("sw.js").match(/const VERSION = "pokevibes-v(\d+)"/)[1];

// Noms exportés par un fichier (export function / const / let, export { … }, export * from …)
function exports(f, vus = new Set()) {
  if (vus.has(f)) return new Set(); vus.add(f);
  const s = lire(f), noms = new Set();
  for (const m of s.matchAll(/^export (?:async )?function (\w+)/gm)) noms.add(m[1]);
  for (const m of s.matchAll(/^export (?:const|let) (.+)$/gm)) for (const n of m[1].matchAll(/(?:^|,\s*)([\w$]+)\s*=/g)) noms.add(n[1]);
  for (const m of s.matchAll(/^export \{([^}]+)\}/gm)) for (const n of m[1].split(",")) noms.add(n.trim().split(/\s+as\s+/).pop());
  for (const m of s.matchAll(/^export \* from "(.+?)"/gm)) for (const n of exports(cible(f, m[1]), vus)) noms.add(n);
  return noms;
}
const cible = (depuis, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(depuis), spec.split("?")[0]));
const importsDe = (f) => [...lire(f).matchAll(/^(?:import|export) (?:\{([^}]*)\}|\*) from "(\.{1,2}\/[^"]+)"/gm)].map((m) => ({ noms: m[1], spec: m[2] }));

test("chaque import pointe vers un fichier existant, à la version du service worker", () => {
  for (const f of FICHIERS) for (const { spec } of importsDe(f)) {
    assert.ok(fs.existsSync(path.join(RACINE, cible(f, spec))), `${f} : ${spec} introuvable`);
    assert.equal(spec.match(/\?v=(\d+)$/)?.[1], VERSION, `${f} : ${spec} doit finir par ?v=${VERSION}`);
  }
});

test("chaque nom importé est bien exporté par son module", () => {
  for (const f of FICHIERS) for (const { noms, spec } of importsDe(f)) {
    if (!noms) continue;
    const dispo = exports(cible(f, spec));
    for (const n of noms.split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean))
      assert.ok(dispo.has(n), `${f} importe « ${n} » de ${spec}, qui ne l'exporte pas`);
  }
});

test("le service worker met en cache tous les fichiers de l'interface, à la bonne version", () => {
  const coquille = [...lire("sw.js").match(/const COQUILLE = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const f of FICHIERS) assert.ok(coquille.includes(`${f}?v=${VERSION}`), `sw.js : ${f}?v=${VERSION} manque dans COQUILLE`);
  assert.ok(coquille.includes(`style.css?v=${VERSION}`));
  for (const f of coquille) assert.ok(fs.existsSync(path.join(RACINE, f === "./" ? "index.html" : f.split("?")[0])), `sw.js : ${f} n'existe pas`);
});

test("index.html charge style.css et app.js à la même version", () => {
  const html = lire("index.html");
  assert.match(html, new RegExp(`style\\.css\\?v=${VERSION}"`));
  assert.match(html, new RegExp(`<script type="module" src="app\\.js\\?v=${VERSION}"`));
});

const PURS = ["js/format.js", "js/prix.js", "js/progression.js", "js/recherche.js", "js/suivi.js", "js/badges-regles.js", "badges.js"];

test("les modules de calcul n'importent que d'autres modules de calcul", () => {
  for (const f of PURS) for (const { spec } of importsDe(f)) assert.ok(PURS.includes(cible(f, spec)), `${f} importe ${spec}, qui n'est pas un module de calcul`);
});

test("les modules de calcul n'utilisent ni la page ni le réseau", () => {
  for (const f of PURS) {
    const s = lire(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(s, /\b(document|window|matchMedia|localStorage|fetch|sb\.)\b/, f);
  }
});
