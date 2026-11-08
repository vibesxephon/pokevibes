import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s) => document.querySelector(s);
const euro = (v, dec = 2) => v == null ? "?" : Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (v) => v == null ? "" : `${v > 0 ? "+" : ""}${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NOM_JEU = { pokemon: "Pokémon", onepiece: "One Piece" };

const etat = {
  moi: null, toutes: [], jeu: "pokemon", categorie: "", recherche: "", tri: "extension",
  vitrine: [], membreChoisi: null, extensions: [], sets: null,
};

/* ================= Connexion ================= */
$("#form-connexion").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim(), pseudo = $("#pseudo").value.trim(), msg = $("#connexion-message");
  msg.textContent = "Envoi du lien…";
  const { error } = await sb.auth.signInWithOtp({
    email, options: { emailRedirectTo: location.origin + location.pathname, data: pseudo ? { pseudo } : undefined },
  });
  msg.textContent = error ? `Le lien n'a pas pu être envoyé : ${error.message}` : `Lien envoyé à ${email}. Ouvre-le sur cet appareil pour te connecter.`;
});
$("#deconnexion").addEventListener("click", () => sb.auth.signOut());

sb.auth.onAuthStateChange((_e, session) => afficher(session));
sb.auth.getSession().then(({ data }) => afficher(data.session));

let charge = false;
async function afficher(session) {
  $("#ecran-connexion").hidden = !!session;
  $("#app").hidden = !session;
  if (!session) { charge = false; return; }
  if (charge) return;
  charge = true;
  const { data: moi } = await sb.from("membres").select("id, pseudo").eq("auth_id", session.user.id).maybeSingle();
  etat.moi = moi;
  $("#mon-pseudo").textContent = moi?.pseudo ?? "toi";
  await chargerCollection();
}

/* ================= Données ================= */
async function chargerCollection() {
  const { data, error } = await sb.from("ma_collection").select("*");
  if (error) { $("#classeur").innerHTML = `<p class="vide">La collection n'a pas pu être chargée : ${esc(error.message)}</p>`; return; }
  etat.toutes = fusionner(data ?? []);
  dessinerCollection();
}

// Un même produit acheté à des prix différents (ex. 3 ETB 30 Ans) = une seule pochette
function fusionner(lignes) {
  const m = new Map();
  for (const x of lignes) {
    const k = `${x.produit_id}|${x.defaut}`;
    const y = m.get(k);
    if (!y) { m.set(k, { ...x, valeur: x.valeur == null ? null : Number(x.valeur), cout: x.cout == null ? null : Number(x.cout) }); continue; }
    y.quantite += x.quantite;
    if (x.valeur != null) y.valeur = (y.valeur ?? 0) + Number(x.valeur);
    if (x.cout != null) y.cout = (y.cout ?? 0) + Number(x.cout);
  }
  for (const y of m.values()) {
    y.prix_achat = y.cout != null ? y.cout / y.quantite : null;
    y.benefice = y.cout != null && y.valeur != null ? y.valeur - y.cout : null;
    y.evolution_pct = y.cout && y.valeur != null ? (y.valeur / y.cout - 1) * 100 : null;
  }
  return [...m.values()];
}

const duJeu = () => etat.toutes.filter((x) => x.jeu === etat.jeu);

function dessinerCollection() {
  $("#titre-collection").textContent = `Collection ${NOM_JEU[etat.jeu]}`;
  resume();
  dessinerClasseur();
}

function resume() {
  const c = duJeu();
  const somme = (l, f) => l.reduce((s, x) => s + Number(f(x) ?? 0), 0);
  const scelle = c.filter((x) => x.categorie === "scelle"), cartes = c.filter((x) => x.categorie === "carte");
  const valeur = somme(c, (x) => x.valeur);
  const achat = somme(c, (x) => x.cout);
  const gain = somme(c.filter((x) => x.cout != null && x.valeur != null), (x) => x.valeur - x.cout);
  const nb = (l) => somme(l, (x) => x.quantite);
  compteur($("#total-valeur"), valeur);
  $("#total-scelle").innerHTML = `${euro(somme(scelle, (x) => x.valeur), 0)} <small>(${nb(scelle)})</small>`;
  $("#total-cartes").innerHTML = `${euro(somme(cartes, (x) => x.valeur), 0)} <small>(${nb(cartes)})</small>`;
  $("#total-achat").textContent = euro(achat, 0);
  const g = $("#total-gain");
  g.textContent = `${gain >= 0 ? "+" : ""}${euro(gain, 0)} (${pct(achat ? (gain / achat) * 100 : 0)})`;
  g.className = gain >= 0 ? "positif" : "negatif";
  requestAnimationFrame(() => { $("#jauge-achat").style.width = `${valeur ? Math.min(100, (achat / valeur) * 100) : 0}%`; });
  const dates = c.map((x) => x.prix_date).filter(Boolean).sort();
  const enAttente = c.filter((x) => x.prix_actuel == null).length;
  $("#maj-prix").textContent = (dates.length ? `Dernier relevé de prix le ${new Date(dates.at(-1)).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}. La jauge montre la part payée.` : "")
    + (enAttente ? ` ${enAttente} objet${enAttente > 1 ? "s" : ""} en attente de prix.` : "");
}

function compteur(el, cible) {
  if (calme) { el.textContent = euro(cible, 0); return; }
  const t0 = performance.now(), duree = 900;
  const pas = (t) => {
    const k = Math.min(1, (t - t0) / duree);
    el.textContent = euro(cible * (1 - Math.pow(1 - k, 3)), 0);
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

/* ================= Classeur ================= */
function filtrer(liste) {
  const q = etat.recherche.toLowerCase();
  return liste.filter((x) => (!etat.categorie || x.categorie === etat.categorie) &&
    (!q || `${x.nom} ${x.numero ?? ""} ${x.extension ?? ""} ${x.rarete ?? ""} ${x.type_scelle ?? ""}`.toLowerCase().includes(q)));
}

function pochette(x, avecAchat = true) {
  const img = x.image_url
    ? `<img src="${esc(x.image_url)}" alt="" loading="lazy">`
    : `<span class="sans-image">${esc(x.categorie === "scelle" ? (x.type_scelle ?? "Scellé") : (x.rarete ?? "Carte"))}</span>`;
  const infos = x.categorie === "carte"
    ? [x.numero, x.rarete, x.langue !== "FR" ? x.langue : null].filter(Boolean).map(esc).join(" ")
    : [esc(x.variante), x.defaut ? `<span class="defaut">défaut</span>` : null].filter(Boolean).join(" ");
  const evo = avecAchat && x.evolution_pct != null
    ? `<span class="evo ${x.evolution_pct >= 0 ? "positif" : "negatif"}">${pct(x.evolution_pct)}</span>` : "";
  const prix = x.prix_actuel == null ? `<strong class="inconnu" title="Prix attendu au prochain relevé">?</strong>` : `<strong>${euro(x.prix_actuel)}</strong>`;
  return `<button class="pochette ${x.categorie}" data-id="${x.produit_id}" data-defaut="${x.defaut}">
    ${x.quantite > 1 ? `<span class="quantite">×${x.quantite}</span>` : ""}
    <span class="visuel">${img}</span>
    <span class="nom">${esc(x.nom)}</span>
    <span class="infos">${infos}</span>
    <span class="prix">${prix}${evo}</span>
  </button>`;
}

const parPrix = (a, b) => Number(b.prix_actuel ?? -1) - Number(a.prix_actuel ?? -1);
function sousSections(items, avecAchat) {
  const sc = items.filter((x) => x.categorie === "scelle").sort(parPrix);
  const ca = items.filter((x) => x.categorie === "carte").sort(parPrix);
  const bloc = (titre, l) => l.length ? `<div class="sous-page"><h4>${titre} <span>${l.reduce((s, x) => s + x.quantite, 0)}</span></h4>
    <div class="pochettes">${l.map((x) => pochette(x, avecAchat)).join("")}</div></div>` : "";
  return bloc("Scellé", sc) + bloc("Cartes", ca);
}

function grouper(liste, avecAchat) {
  if (etat.tri !== "extension") {
    const cle = etat.tri === "gain" ? (x) => Number(x.benefice ?? -1e9) : (x) => Number(x.valeur ?? 0);
    return `<div class="page"><div class="pochettes">${[...liste].sort((a, b) => cle(b) - cle(a)).map((x) => pochette(x, avecAchat)).join("")}</div></div>`;
  }
  const pages = new Map();
  for (const x of liste) {
    const k = `${x.jeu}|${x.ordre ?? "Z"}|${x.extension ?? "Divers"}`;
    if (!pages.has(k)) pages.set(k, []);
    pages.get(k).push(x);
  }
  const cles = [...pages.keys()].sort((a, b) => {
    const [ja, oa] = a.split("|"), [jb, ob] = b.split("|");
    return jb.localeCompare(ja) || ob.localeCompare(oa, "fr", { numeric: true });
  });
  return cles.map((k) => {
    const items = pages.get(k), x0 = items[0];
    const somme = items.reduce((s, x) => s + Number(x.valeur ?? 0), 0);
    return `<section class="page">
      <div class="page-titre"><h3>${esc(x0.extension ?? "Divers")}</h3><span class="code">${esc(x0.extension_code ?? "")}</span><span class="somme">${euro(somme, 0)}</span></div>
      ${sousSections(items, avecAchat)}
    </section>`;
  }).join("");
}

function dessinerClasseur() {
  const liste = filtrer(duJeu());
  $("#classeur").innerHTML = liste.length ? grouper(liste, true)
    : duJeu().length ? `<p class="vide">Rien ne correspond à ces filtres. Essaie « Scellé et cartes » ou une autre recherche.</p>`
    : `<p class="vide">Ta collection ${NOM_JEU[etat.jeu]} est vide. Appuie sur « + Ajouter » pour commencer.</p>`;
}

document.querySelectorAll(".filtres .puces").forEach((g) => g.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  etat[g.dataset.filtre] = b.dataset.val;
  dessinerClasseur();
}));
$("#recherche").addEventListener("input", (e) => { etat.recherche = e.target.value; dessinerClasseur(); });
$("#tri").addEventListener("change", (e) => { etat.tri = e.target.value; dessinerClasseur(); });

/* ================= Onglets ================= */
document.querySelectorAll(".onglet").forEach((o) => o.addEventListener("click", () => {
  document.querySelectorAll(".onglet").forEach((x) => x.toggleAttribute("aria-current", x === o));
  o.setAttribute("aria-current", "page");
  const v = o.dataset.vue, equipage = v === "equipage";
  $("#vue-collection").hidden = equipage;
  $("#vue-equipage").hidden = !equipage;
  $("#bouton-ajouter").hidden = equipage;
  if (equipage) chargerEquipage();
  else { etat.jeu = v; dessinerCollection(); }
  scrollTo({ top: 0 });
}));

async function chargerEquipage() {
  const { data, error } = await sb.from("vitrine").select("*");
  if (error) { $("#membres").innerHTML = `<li class="vide">L'Équipage n'a pas pu être chargé : ${esc(error.message)}</li>`; return; }
  etat.vitrine = data ?? [];
  const parMembre = new Map();
  for (const x of etat.vitrine) {
    const m = parMembre.get(x.pseudo) ?? { valeur: 0, objets: 0 };
    m.valeur += Number(x.valeur ?? 0); m.objets += x.quantite;
    parMembre.set(x.pseudo, m);
  }
  $("#membres").innerHTML = [...parMembre.entries()].sort((a, b) => b[1].valeur - a[1].valeur).map(([p, m]) => `<li><button data-pseudo="${esc(p)}" aria-pressed="${p === etat.membreChoisi}">
      <span><span class="pseudo">${esc(p)}</span><br><span class="infos">${m.objets} objets</span></span>
      <span class="valeur">${euro(m.valeur, 0)}</span></button></li>`).join("")
    || `<li class="vide">Personne n'a encore de collection. Partage le lien du site à L'Équipage.</li>`;
  dessinerVitrine();
}
$("#membres").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  etat.membreChoisi = etat.membreChoisi === b.dataset.pseudo ? null : b.dataset.pseudo;
  document.querySelectorAll("#membres button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.pseudo === etat.membreChoisi)));
  dessinerVitrine();
});
function dessinerVitrine() {
  const liste = etat.vitrine.filter((x) => x.pseudo === etat.membreChoisi);
  $("#vitrine").innerHTML = !etat.membreChoisi ? "" : ["pokemon", "onepiece"].map((j) => {
    const l = liste.filter((x) => x.jeu === j);
    return l.length ? `<h3 class="titre-jeu">Collection ${NOM_JEU[j]}</h3>${grouper(l, false)}` : "";
  }).join("");
}

/* ================= Fiche ================= */
document.addEventListener("click", async (e) => {
  const p = e.target.closest(".pochette"); if (!p) return;
  const id = Number(p.dataset.id), defaut = p.dataset.defaut === "true";
  const mien = !!p.closest("#classeur");
  const x = (mien ? etat.toutes : etat.vitrine).find((y) => y.produit_id === id && y.defaut === defaut);
  if (x) ouvrirFiche(x, mien);
});

async function ouvrirFiche(x, mien) {
  const { data: hist } = await sb.from("prix").select("le, prix, source, valide")
    .eq("produit_id", x.produit_id).eq("etat_prix", x.defaut ? "defaut" : "standard").order("le");
  const valides = (hist ?? []).filter((h) => h.valide);
  const suspect = (hist ?? []).filter((h) => !h.valide).at(-1);
  const sources = { airtable: "relevé Airtable", api_fr: "Cardmarket FR (automatique)", manuel: "saisie manuelle" };
  $("#fiche-contenu").innerHTML = `
    <div class="fiche-haut">
      <span class="visuel">${x.image_url ? `<img src="${esc(x.image_url)}" alt="">` : `<span class="sans-image">${esc(x.type_scelle ?? x.rarete ?? "")}</span>`}</span>
      <div>
        <h2>${esc(x.nom)}</h2>
        <p class="infos">${esc(x.extension ?? "")} ${esc(x.numero ?? "")}</p>
        ${x.defaut ? `<p class="defaut">Exemplaire avec défaut</p>` : ""}
      </div>
    </div>
    <dl>
      <dt>Prix actuel</dt><dd>${x.prix_actuel == null ? "? <span class='infos'>attendu au prochain relevé</span>" : euro(x.prix_actuel)}</dd>
      <dt>Quantité</dt><dd>${mien ? `<span class="stepper"><button data-delta="-1" aria-label="Retirer un exemplaire">−</button><span id="fiche-qte">${x.quantite}</span><button data-delta="1" aria-label="Ajouter un exemplaire">+</button></span>` : x.quantite}</dd>
      <dt>Valeur</dt><dd>${euro(x.valeur)}</dd>
      ${mien && x.prix_achat != null ? `<dt>Payé</dt><dd>${euro(x.prix_achat)} l'unité${x.quantite > 1 ? " en moyenne" : ""}</dd><dt>Plus-value</dt><dd class="${(x.benefice ?? 0) >= 0 ? "evo positif" : "evo negatif"}">${euro(x.benefice)} (${pct(x.evolution_pct)})</dd>` : ""}
      ${mien && x.prix_achat == null && x.categorie === "carte" ? `<dt>Origine</dt><dd>Tirée d'un booster 🎁</dd>` : ""}
      <dt>Source</dt><dd>${esc(sources[x.prix_source] ?? x.prix_source ?? "—")}${x.prix_date ? `, le ${new Date(x.prix_date).toLocaleDateString("fr-FR")}` : ""}</dd>
    </dl>
    ${suspect ? `<p class="alerte">Prix en attente de confirmation : ${euro(suspect.prix)} le ${new Date(suspect.le).toLocaleDateString("fr-FR")}. Il sera pris en compte s'il se confirme au prochain relevé.</p>` : ""}
    ${courbe(valides)}
    ${x.lien_cardmarket ? `<p><a href="${esc(x.lien_cardmarket)}" target="_blank" rel="noopener">Voir les offres FR sur Cardmarket</a></p>` : ""}
    ${mien ? `<details class="prix-manuel"><summary>Saisir un prix moi-même</summary>
      <div class="ligne-recherche"><input id="prix-manuel" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Prix unitaire en €"><button id="valider-prix" type="button">Enregistrer</button></div>
      <p class="aide">Utile pour les produits que le relevé automatique ne suit pas (boosters à l'unité, coffrets, One Piece).</p></details>` : ""}
    <p id="fiche-message" class="message" role="status"></p>`;
  $("#fiche").showModal();

  if (!mien) return;
  $("#fiche-contenu").querySelectorAll("[data-delta]").forEach((b) => b.addEventListener("click", async () => {
    const delta = Number(b.dataset.delta);
    if (delta < 0 && x.quantite === 1 && !confirm(`Retirer « ${x.nom} » de ta collection ?`)) return;
    const { data: reste, error } = await sb.rpc("modifier_quantite", { p_produit_id: x.produit_id, p_defaut: x.defaut, p_delta: delta });
    if (error) { $("#fiche-message").textContent = `Modification impossible : ${error.message}`; return; }
    x.quantite = reste;
    $("#fiche-qte").textContent = reste;
    await chargerCollection();
    if (reste === 0) $("#fiche").close();
  }));
  $("#valider-prix")?.addEventListener("click", async () => {
    const v = Number($("#prix-manuel").value);
    if (!(v >= 0) || $("#prix-manuel").value === "") { $("#fiche-message").textContent = "Indique un prix en euros, par exemple 12,50."; return; }
    const { error } = await sb.rpc("saisir_prix", { p_produit_id: x.produit_id, p_prix: v, p_defaut: x.defaut });
    $("#fiche-message").textContent = error ? `Prix non enregistré : ${error.message}` : `Prix enregistré : ${euro(v)}.`;
    if (!error) chargerCollection();
  });
}

function courbe(points) {
  if (points.length < 2) return `<div class="historique"><p>L'historique des prix se construit à chaque relevé.</p></div>`;
  const v = points.map((p) => Number(p.prix)), min = Math.min(...v), max = Math.max(...v), w = 300, h = 60;
  const xy = v.map((y, i) => `${(i / (v.length - 1)) * w},${max === min ? h / 2 : h - ((y - min) / (max - min)) * h}`).join(" ");
  return `<div class="historique">
    <svg viewBox="-4 -4 ${w + 8} ${h + 8}" preserveAspectRatio="none" role="img" aria-label="Évolution du prix de ${euro(v[0])} à ${euro(v.at(-1))}">
      <polyline points="${xy}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    </svg>
    <p>${points.length} relevés, de ${euro(min)} à ${euro(max)}</p></div>`;
}

/* ================= Catalogue (TCGdex / OPTCG via notre relais) ================= */
async function catalogue(url) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/catalogue?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_KEY },
  });
  if (!r.ok) throw new Error(`catalogue indisponible (${r.status})`);
  return r.json();
}
const TCG = "https://api.tcgdex.net/v2";
async function setsPokemon() {
  if (!etat.sets) {
    const l = await catalogue(`${TCG}/fr/sets`);
    etat.sets = new Map(l.map((s) => [s.id, s]));
  }
  return etat.sets;
}
const RARETES = { "illustration rare": "AR", "illustration spéciale rare": "SAR", "hyper rare": "Gold", "ultra rare": "FA", "promo": "Promo" };

/* ================= Ajout ================= */
const ajout = { type: "carte", choix: null };

$("#bouton-ajouter").addEventListener("click", async () => {
  ajout.choix = null;
  $("#ajout-titre").textContent = `Ajouter à la collection ${NOM_JEU[etat.jeu]}`;
  $("#ajout-message").textContent = "";
  $("#carte-resultats").innerHTML = ""; $("#carte-statut").textContent = "";
  $("#op-resultats").innerHTML = ""; $("#op-statut").textContent = ""; $("#scan-statut").textContent = "";
  $("#aj-quantite").value = 1; $("#aj-prix").value = "";
  choisirType("carte");
  $("#ajout").showModal();
  await remplirExtensions();
});

$("#ajout-type").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) choisirType(b.dataset.val); });
function choisirType(t) {
  ajout.type = t; ajout.choix = null;
  $("#ajout-type").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === t)));
  const carte = t === "carte", poke = etat.jeu === "pokemon";
  $("#ajout-carte-pokemon").hidden = !(carte && poke);
  $("#ajout-carte-onepiece").hidden = !(carte && !poke);
  $("#ajout-scelle").hidden = carte;
  $("#bloc-etat").hidden = !carte;
  $("#ajout-final").hidden = carte && poke; // la carte Pokémon s'affiche une fois choisie
  $("#ajout-choix").innerHTML = "";
}

async function remplirExtensions() {
  const { data } = await sb.from("extensions").select("id, jeu, code, nom_fr, nom_en, ordre").order("ordre", { ascending: false });
  etat.extensions = data ?? [];
  $("#sc-extension").innerHTML = etat.extensions.filter((e) => e.jeu === etat.jeu)
    .map((e) => `<option value="${e.id}">${esc(e.nom_fr)} (${esc(e.code)})</option>`).join("");
  nomScelle();
}
function nomScelle() {
  const e = etat.extensions.find((x) => String(x.id) === $("#sc-extension").value);
  const type = $("#sc-type").value, v = $("#sc-variante").value.trim();
  $("#sc-nom").value = `${type} ${e?.code ?? ""}${v ? " " + v : ""}`.trim();
}
["#sc-extension", "#sc-type", "#sc-variante"].forEach((s) => $(s).addEventListener("input", nomScelle));

// --- Recherche de cartes Pokémon ---
$("#bouton-chercher").addEventListener("click", () => chercherCartes($("#recherche-carte").value));
$("#recherche-carte").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); chercherCartes(e.target.value); } });

async function chercherCartes(saisie) {
  const q = saisie.trim(); if (!q) return;
  const statut = $("#carte-statut");
  statut.textContent = "Recherche…";
  try {
    const m = q.match(/^(TG|GG)?\s*0*(\d{1,3})\s*(?:\/\s*(?:TG|GG)?\s*(\d{1,3}))?$/i);
    let res;
    if (m) res = await parNumero(m[1] ? `${m[1].toUpperCase()}${m[2].padStart(2, "0")}` : m[2], m[3] ? Number(m[3]) : null);
    else res = (await catalogue(`${TCG}/fr/cards?name=${encodeURIComponent(q)}`));
    await afficherResultats(res.slice(0, 60));
    statut.textContent = res.length ? `${res.length} carte${res.length > 1 ? "s" : ""} trouvée${res.length > 1 ? "s" : ""}. Touche la tienne.` : "Aucune carte trouvée. Essaie le nom exact ou le numéro complet (ex. 144/131).";
  } catch (err) { statut.textContent = `Recherche impossible : ${err.message}`; }
}

async function parNumero(num, total) {
  const essais = [...new Set([num, num.padStart(3, "0"), String(Number(num) || num)])];
  const vus = new Map();
  for (const n of essais) for (const c of await catalogue(`${TCG}/fr/cards?localId=${encodeURIComponent(n)}`)) vus.set(c.id, c);
  let l = [...vus.values()];
  if (total) {
    const sets = await setsPokemon();
    const bons = l.filter((c) => sets.get(c.id.slice(0, c.id.lastIndexOf("-")))?.cardCount?.official === total);
    if (bons.length) l = bons;
  }
  return l.reverse(); // les extensions récentes d'abord
}

// Les cartes toutes récentes (ex. Règne Delta) et les promos n'ont pas encore d'image dans TCGdex :
// on les affiche quand même, avec une vignette provisoire. L'image arrive plus tard (relevé de la nuit).
function vignetteProvisoire(nom, numero, ext) {
  return `<span class="vignette-provisoire"><strong>${esc(nom)}</strong><span>${esc(numero)}</span><span>${esc(ext ?? "")}</span></span>`;
}
async function afficherResultats(liste) {
  const sets = await setsPokemon().catch(() => new Map());
  $("#carte-resultats").innerHTML = liste.map((c) => {
    const sid = c.id.slice(0, c.id.lastIndexOf("-")), set = sets.get(sid);
    const num = `${c.localId}${set?.cardCount?.official ? "/" + set.cardCount.official : ""}`;
    const visuel = c.image ? `<img src="${esc(c.image)}/low.webp" alt="" loading="lazy">` : vignetteProvisoire(c.name, num, set?.name);
    return `<button class="resultat" data-id="${esc(c.id)}">${visuel}<span>${esc(c.name)}</span><span class="infos">${esc(set?.name ?? sid)} · ${esc(num)}</span></button>`;
  }).join("");
}
$("#carte-resultats").addEventListener("click", async (e) => {
  const b = e.target.closest(".resultat"); if (!b) return;
  $("#carte-statut").textContent = "Chargement de la carte…";
  try {
    const [fr, en] = await Promise.all([catalogue(`${TCG}/fr/cards/${b.dataset.id}`), catalogue(`${TCG}/en/cards/${b.dataset.id}`).catch(() => null)]);
    const cm = (fr.variants_detailed ?? []).map((v) => v.thirdParty?.cardmarket).find(Boolean) ?? null;
    ajout.choix = {
      tcgdex_id: fr.id, nom: fr.name, nom_en: en?.name ?? null,
      numero: `${fr.localId}/${fr.set?.cardCount?.official ?? "?"}`,
      rarete: RARETES[(fr.rarity ?? "").toLowerCase()] ?? fr.rarity ?? null,
      set_id: fr.set?.id, set_nom: fr.set?.name, set_nom_en: en?.set?.name ?? null,
      image: fr.image ? `${fr.image}/high.webp` : null, cardmarket_id: cm,
    };
    $("#ajout-choix").innerHTML = `${fr.image ? `<img src="${esc(fr.image)}/low.webp" alt="">` : vignetteProvisoire(fr.name, ajout.choix.numero, "")}<div><strong>${esc(fr.name)}</strong><br>
      <span class="infos">${esc(fr.set?.name)} · ${esc(ajout.choix.numero)} · ${esc(ajout.choix.rarete ?? "")}</span>${fr.image ? "" : `<br><span class="infos">Image pas encore disponible, elle s'ajoutera toute seule.</span>`}</div>`;
    $("#ajout-final").hidden = false;
    $("#carte-statut").textContent = "";
    $("#ajout-final").scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "nearest" });
  } catch (err) { $("#carte-statut").textContent = `Carte introuvable : ${err.message}`; }
});

// --- Scanner : reconnaissance par IA (Gemini), lecture du numéro en secours ---
const sansAccent = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function ressemblance(a, b) {
  const x = new Set(sansAccent(a).split(" ").filter(Boolean)), y = new Set(sansAccent(b).split(" ").filter(Boolean));
  if (!x.size || !y.size) return 0;
  let commun = 0; for (const m of x) if (y.has(m)) commun++;
  return commun / Math.max(x.size, y.size);
}
// Décodage de la photo : <img> d'abord (fiable sur iPhone, orientation EXIF appliquée), createImageBitmap en secours
function avecDelai(promesse, ms, quoi) {
  return Promise.race([promesse, new Promise((_, ko) => setTimeout(() => ko(new Error(`${quoi} trop long`)), ms))]);
}
async function decoderPhoto(f) {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.decoding = "async";
    await avecDelai(new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error("format de photo non lu")); img.src = url; }), 20000, "ouverture de la photo");
    return img;
  } catch (e1) {
    try { return await avecDelai(createImageBitmap(f), 20000, "ouverture de la photo"); }
    catch { throw e1; }
  } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
async function photoReduite(f, max = 1280) {
  const src = await decoderPhoto(f);
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.85);
  const image = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (image.length < 1000) throw new Error("photo vide");
  return { image, mime: "image/jpeg", bmp: c };
}

let scanEnCours = false;
$("#scan-photo").addEventListener("change", async (e) => {
  const input = e.target;
  const f = input.files?.[0]; if (!f || scanEnCours) return;
  scanEnCours = true;
  const statut = $("#scan-statut");
  statut.classList.add("en-cours");
  statut.textContent = "Photo reçue, préparation… 📸";
  let photo;
  try {
    photo = await photoReduite(f);
    statut.textContent = "L'IA regarde ta photo… 🔍 (quelques secondes)";
    const { data: r, error } = await avecDelai(
      sb.functions.invoke("reconnaitre", { body: { image: photo.image, mime: photo.mime } }), 45000, "réponse de l'IA");
    if (error || !r || r.erreur) throw new Error(r?.erreur ?? error?.message ?? "pas de réponse");
    await appliquerReconnaissance(r);
  } catch (err) {
    statut.textContent = `L'IA n'a pas pu lire la photo (${err.message}).${photo ? " Lecture du numéro en secours…" : " Réessaie, ou cherche la carte par nom."}`;
    if (photo) await lectureNumero(photo.bmp);
  } finally {
    statut.classList.remove("en-cours");
    input.value = ""; // seulement après lecture (sur iPhone, vider avant rend la photo illisible)
    scanEnCours = false;
  }
});

async function appliquerReconnaissance(r) {
  const statut = $("#scan-statut");
  const jeu = r.jeu === "onepiece" ? "onepiece" : "pokemon";
  if (jeu !== etat.jeu) basculerJeu(jeu);
  const resume = [r.nom, r.numero && (r.total ? `${r.numero}/${r.total}` : r.numero), r.extension].filter(Boolean).join(" · ");
  statut.textContent = `Reconnu : ${resume || "objet incertain"}${r.confiance < 0.6 ? " (pas sûr, vérifie bien)" : ""}`;

  if (r.categorie === "scelle") {
    choisirType("scelle");
    await remplirExtensions();
    const cible = [r.code_extension, r.extension, r.nom].map(sansAccent).filter(Boolean);
    const ext = etat.extensions.filter((x) => x.jeu === etat.jeu)
      .map((x) => ({ x, score: Math.max(...cible.map((c) => Math.max(ressemblance(c, x.nom_fr), ressemblance(c, x.nom_en ?? ""), sansAccent(x.code) && c.includes(sansAccent(x.code)) ? 1 : 0))) }))
      .sort((a, b) => b.score - a.score)[0];
    if (ext?.score > 0.3) $("#sc-extension").value = String(ext.x.id);
    const types = [...$("#sc-type").options].map((o) => o.value);
    if (types.includes(r.type_scelle)) $("#sc-type").value = r.type_scelle;
    nomScelle();
    return;
  }

  choisirType("carte");
  if (jeu === "onepiece") {
    $("#op-numero").value = (r.numero ?? "").toUpperCase();
    if (r.langue && [...$("#op-langue").options].some((o) => o.value === r.langue)) $("#op-langue").value = r.langue;
    const liste = await chercherOP($("#op-numero").value);
    const motif = { alternative: /(Alternate|Parallel|Full Art)/i, manga: /Manga/i, sp: /\(SP\)/i }[r.version];
    const i = liste.findIndex((c) => motif ? motif.test(c.card_name) : !/\((Alternate|Parallel|Manga|SP|Full Art|Super|Wanted)/i.test(c.card_name));
    if (i >= 0) $(`#op-resultats .resultat[data-i="${i}"]`)?.click();
    else if (r.nom) $("#op-nom").value = r.nom;
    return;
  }

  // Pokémon : par numéro d'abord, puis par nom ; la plus ressemblante en premier
  let res = [];
  if (r.numero) {
    const brut = String(r.numero).toUpperCase().replace(/\s+/g, "");
    res = await parNumero(/^(TG|GG|SV)/.test(brut) ? brut : brut.replace(/^0+(?=\d)/, ""), r.total ? Number(r.total) : null);
  }
  if (!res.length && r.nom) res = (await catalogue(`${TCG}/fr/cards?name=${encodeURIComponent(r.nom.split(" ")[0])}`));
  const classe = res.map((c) => ({ c, s: ressemblance(c.name, r.nom) + 0.5 * ressemblance(c.name, r.nom_en) }))
    .sort((a, b) => b.s - a.s).map((x) => x.c).slice(0, 40);
  $("#recherche-carte").value = r.numero ? `${r.numero}${r.total ? "/" + r.total : ""}` : (r.nom ?? "");
  await afficherResultats(classe);
  if (classe.length) {
    $("#carte-statut").textContent = "La première carte est la proposition de l'IA. Si ce n'est pas la bonne, touche la tienne.";
    $("#carte-resultats .resultat")?.click();
  } else $("#carte-statut").textContent = "Aucune carte correspondante dans le catalogue. Cherche par nom ci-dessous.";
}

function basculerJeu(jeu) {
  etat.jeu = jeu;
  document.querySelectorAll(".onglet").forEach((x) => x.toggleAttribute("aria-current", x.dataset.vue === jeu));
  document.querySelector(`.onglet[data-vue="${jeu}"]`)?.setAttribute("aria-current", "page");
  $("#ajout-titre").textContent = `Ajouter à la collection ${NOM_JEU[jeu]}`;
  dessinerCollection();
}

// Secours sans IA : lecture du numéro en bas de la carte
let tesseract = null;
function chargerTesseract() {
  if (tesseract) return tesseract;
  tesseract = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => ok(window.Tesseract); s.onerror = () => ko(new Error("lecteur indisponible"));
    document.head.appendChild(s);
  });
  return tesseract;
}
function bandeBasse(bitmap, part) {
  const sy = Math.round(bitmap.height * (1 - part)), sh = bitmap.height - sy, k = Math.max(1, 1600 / bitmap.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * k); c.height = Math.round(sh * k);
  const g = c.getContext("2d");
  g.filter = "grayscale(1) contrast(1.8)";
  g.drawImage(bitmap, 0, sy, bitmap.width, sh, 0, 0, c.width, c.height);
  return c;
}
async function lectureNumero(bmp) {
  const statut = $("#scan-statut");
  try {
    const T = await chargerTesseract();
    const w = await T.createWorker("eng");
    await w.setParameters({ tessedit_char_whitelist: "0123456789/TGSVHPMER " });
    let trouve = null;
    for (const part of [0.14, 0.25, 1]) {
      const { data } = await w.recognize(bandeBasse(bmp, part));
      trouve = data.text.match(/(TG|GG)?\s?0*(\d{1,3})\s*\/\s*(?:TG|GG)?\s?(\d{2,3})/i);
      if (trouve) break;
    }
    await w.terminate();
    if (!trouve) { statut.textContent = "Photo illisible. Réessaie avec plus de lumière, ou tape le numéro (ex. 144/131)."; return; }
    const texte = `${trouve[1] ?? ""}${trouve[2]}/${trouve[3]}`;
    choisirType("carte");
    $("#recherche-carte").value = texte;
    statut.textContent = `Numéro lu : ${texte}.`;
    await chercherCartes(texte);
  } catch (err) { statut.textContent = `Scanner indisponible : ${err.message}. Tape le numéro à la place.`; }
}

// --- One Piece : trouver l'image et le nom par le numéro ---
$("#op-chercher").addEventListener("click", () => chercherOP($("#op-numero").value));
async function chercherOP(saisie) {
  const n = saisie.trim().toUpperCase(); if (!n) return [];
  const statut = $("#op-statut");
  statut.textContent = "Recherche…";
  const type = n.startsWith("ST") ? "decks" : n.startsWith("P-") ? "promos" : "sets";
  try {
    const l = await catalogue(`https://optcgapi.com/api/${type}/card/${n}/`);
    const liste = Array.isArray(l) ? l : [];
    $("#op-resultats").innerHTML = liste.map((c, i) => `<button class="resultat" data-i="${i}"><img src="${esc(c.card_image)}" alt="" loading="lazy"><span>${esc(c.card_name)}</span></button>`).join("");
    ajout.opListe = liste;
    statut.textContent = liste.length ? "Touche la bonne version (normale, alternative, manga…)." : "Aucune carte trouvée pour ce numéro. Remplis le nom à la main.";
    return liste;
  } catch (err) { statut.textContent = `Recherche impossible : ${err.message}. Remplis le nom à la main.`; return []; }
}
$("#op-resultats").addEventListener("click", (e) => {
  const b = e.target.closest(".resultat"); if (!b) return;
  const c = ajout.opListe[Number(b.dataset.i)];
  ajout.opImage = c.card_image;
  $("#op-nom").value = c.card_name.replace(/\s*\((Alternate Art|Parallel|Manga|SP|Full Art)\)/gi, "").replace(/\./g, " ").replace(/\s+/g, " ").trim();
  const n = c.card_name;
  $("#op-rarete").value = /Manga/i.test(n) ? "Manga" : /\(SP\)/i.test(n) ? "SP" : /(Alternate|Parallel|Full Art)/i.test(n) ? "Parallèle"
    : ({ L: "Leader", SR: "SR", SEC: "SEC", R: "R", UC: "UC", C: "C", TR: "TR", P: "Promo" }[c.rarity] ?? "SR");
  $("#op-resultats").querySelectorAll(".resultat").forEach((x) => x.classList.toggle("choisi", x === b));
});

// --- Valider ---
$("#bouton-valider").addEventListener("click", async () => {
  const msg = $("#ajout-message"), q = Math.max(1, Number($("#aj-quantite").value) || 1);
  const prix = $("#aj-prix").value === "" ? null : Number($("#aj-prix").value);
  let r;
  if (ajout.type === "scelle") {
    const type = $("#sc-type").value, demi = type === "Demi Display";
    r = await sb.rpc("ajouter_scelle", {
      p_jeu: etat.jeu, p_extension_id: Number($("#sc-extension").value) || null,
      p_type: demi ? "Display" : type, p_variante: demi ? "Demi (18 boosters)" : $("#sc-variante").value,
      p_nom: $("#sc-nom").value.trim(), p_quantite: q, p_prix_achat: prix, p_defaut: $("#sc-defaut").checked,
    });
  } else if (etat.jeu === "pokemon") {
    if (!ajout.choix) { msg.textContent = "Choisis d'abord ta carte dans la liste."; return; }
    const c = ajout.choix;
    r = await sb.rpc("ajouter_carte_pokemon", {
      p_tcgdex_id: c.tcgdex_id, p_nom: c.nom, p_nom_en: c.nom_en, p_numero: c.numero, p_rarete: c.rarete,
      p_set_id: c.set_id, p_set_nom: c.set_nom, p_set_nom_en: c.set_nom_en, p_image: c.image, p_cardmarket_id: c.cardmarket_id,
      p_quantite: q, p_etat: $("#aj-etat").value, p_prix_achat: prix, p_langue: "FR",
    });
  } else {
    const numero = $("#op-numero").value.trim().toUpperCase(), nom = $("#op-nom").value.trim();
    if (!numero || !nom) { msg.textContent = "Indique au moins le numéro et le nom de la carte."; return; }
    r = await sb.rpc("ajouter_carte_onepiece", {
      p_numero: numero, p_nom: nom, p_rarete: $("#op-rarete").value, p_extension_code: numero.startsWith("P-") ? "PROMO" : numero.split("-")[0],
      p_langue: $("#op-langue").value, p_image: ajout.opImage ?? null, p_quantite: q, p_prix_achat: prix,
    });
  }
  if (r.error) { msg.textContent = `Ajout impossible : ${r.error.message}`; return; }
  msg.textContent = "Ajouté ✅ Le prix s'affichera après le relevé de cette nuit.";
  await chargerCollection();
  setTimeout(() => $("#ajout").close(), 900);
});

/* ================= Installation (PWA) ================= */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
