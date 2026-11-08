import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s) => document.querySelector(s);
const euro = (v, dec = 2) => v == null ? "—" : Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (v) => v == null ? "" : `${v > 0 ? "+" : ""}${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;

const etat = { moi: null, collection: [], filtres: { jeu: "", categorie: "" }, recherche: "", tri: "extension", vitrine: [], membreChoisi: null };

/* ---------------- Connexion ---------------- */
$("#form-connexion").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const pseudo = $("#pseudo").value.trim();
  const msg = $("#connexion-message");
  msg.textContent = "Envoi du lien…";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname, data: pseudo ? { pseudo } : undefined },
  });
  msg.textContent = error
    ? `Le lien n'a pas pu être envoyé : ${error.message}`
    : `Lien envoyé à ${email}. Ouvre-le sur cet appareil pour te connecter.`;
});
$("#deconnexion").addEventListener("click", () => sb.auth.signOut());

sb.auth.onAuthStateChange((_evt, session) => afficher(session));
sb.auth.getSession().then(({ data }) => afficher(data.session));

let charge = false;
async function afficher(session) {
  $("#ecran-connexion").hidden = !!session;
  $("#app").hidden = !session;
  if (!session) { charge = false; return; }
  if (charge) return;
  charge = true;
  await chargerCollection(session.user.id);
}

/* ---------------- Données ---------------- */
async function chargerCollection(uid) {
  const { data: moi } = await sb.from("membres").select("id, pseudo").eq("auth_id", uid).maybeSingle();
  etat.moi = moi;
  $("#mon-pseudo").textContent = moi?.pseudo ?? "toi";
  const { data, error } = await sb.from("ma_collection").select("*");
  if (error) { $("#classeur").innerHTML = `<p class="vide">La collection n'a pas pu être chargée : ${esc(error.message)}</p>`; return; }
  etat.collection = fusionner(data ?? []);
  resume();
  dessinerClasseur();
}

// Un même produit acheté à des prix différents (ex. 3 ETB 30 Ans) = une seule pochette
function fusionner(lignes) {
  const m = new Map();
  for (const x of lignes) {
    const k = `${x.produit_id}|${x.defaut}`;
    const y = m.get(k);
    if (!y) { m.set(k, { ...x, valeur: Number(x.valeur ?? 0), cout: x.cout == null ? null : Number(x.cout) }); continue; }
    y.quantite += x.quantite;
    y.valeur += Number(x.valeur ?? 0);
    if (x.cout != null) y.cout = (y.cout ?? 0) + Number(x.cout);
  }
  for (const y of m.values()) {
    y.prix_achat = y.cout != null ? y.cout / y.quantite : null;
    y.benefice = y.cout != null ? y.valeur - y.cout : null;
    y.evolution_pct = y.cout ? (y.valeur / y.cout - 1) * 100 : null;
  }
  return [...m.values()];
}

function resume() {
  const c = etat.collection;
  const valeur = c.reduce((s, x) => s + Number(x.valeur ?? 0), 0);
  const achat = c.reduce((s, x) => s + Number(x.cout ?? 0), 0);
  const valeurAchetee = c.filter((x) => x.cout != null).reduce((s, x) => s + Number(x.valeur ?? 0), 0);
  const gain = valeurAchetee - achat;
  const objets = c.reduce((s, x) => s + x.quantite, 0);
  compteur($("#total-valeur"), valeur);
  $("#total-achat").textContent = euro(achat, 0);
  const g = $("#total-gain");
  g.textContent = `${gain >= 0 ? "+" : ""}${euro(gain, 0)} (${pct(achat ? (gain / achat) * 100 : 0)})`;
  g.className = gain >= 0 ? "positif" : "negatif";
  $("#total-objets").textContent = objets.toLocaleString("fr-FR");
  requestAnimationFrame(() => { $("#jauge-achat").style.width = `${valeur ? Math.min(100, (achat / valeur) * 100) : 0}%`; });
  const dates = c.map((x) => x.prix_date).filter(Boolean).sort();
  $("#maj-prix").textContent = dates.length ? `Prix Cardmarket FR, dernier relevé le ${new Date(dates.at(-1)).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}. La jauge montre la part payée.` : "";
}

// Le seul effet au chargement : la valeur qui défile comme un score
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

/* ---------------- Classeur ---------------- */
function filtrer(liste) {
  const q = etat.recherche.toLowerCase();
  return liste.filter((x) =>
    (!etat.filtres.jeu || x.jeu === etat.filtres.jeu) &&
    (!etat.filtres.categorie || x.categorie === etat.filtres.categorie) &&
    (!q || `${x.nom} ${x.numero ?? ""} ${x.extension ?? ""} ${x.rarete ?? ""} ${x.type_scelle ?? ""}`.toLowerCase().includes(q)));
}

function pochette(x, avecAchat = true) {
  const img = x.image_url
    ? `<img src="${esc(x.image_url)}" alt="" loading="lazy">`
    : `<span class="sans-image">${esc(x.categorie === "scelle" ? (x.type_scelle ?? "Scellé") : (x.rarete ?? "Carte"))}</span>`;
  const infos = x.categorie === "carte"
    ? [x.numero, x.rarete, x.langue !== "FR" ? x.langue : null].filter(Boolean).map(esc).join(" ")
    : [x.type_scelle, x.defaut ? `<span class="defaut">défaut</span>` : null].filter(Boolean).join(" ");
  const evo = avecAchat && x.evolution_pct != null
    ? `<span class="evo ${x.evolution_pct >= 0 ? "positif" : "negatif"}">${pct(x.evolution_pct)}</span>` : "";
  return `<button class="pochette ${x.categorie}" data-id="${x.produit_id}" data-defaut="${x.defaut}">
    ${x.quantite > 1 ? `<span class="quantite">×${x.quantite}</span>` : ""}
    <span class="visuel">${img}</span>
    <span class="nom">${esc(x.nom)}</span>
    <span class="infos">${infos}</span>
    <span class="prix"><strong>${euro(x.prix_actuel)}</strong>${evo}</span>
  </button>`;
}

function grouper(liste, avecAchat) {
  if (etat.tri !== "extension") {
    const cle = etat.tri === "gain" ? (x) => Number(x.benefice ?? -1e9) : (x) => Number(x.valeur ?? 0);
    const tri = [...liste].sort((a, b) => cle(b) - cle(a));
    return `<div class="page"><div class="pochettes">${tri.map((x) => pochette(x, avecAchat)).join("")}</div></div>`;
  }
  const pages = new Map();
  for (const x of liste) {
    const k = `${x.jeu}|${x.ordre ?? "Z"}|${x.extension ?? "Divers"}`;
    if (!pages.has(k)) pages.set(k, []);
    pages.get(k).push(x);
  }
  const cles = [...pages.keys()].sort((a, b) => {
    const [ja, oa] = a.split("|"), [jb, ob] = b.split("|");
    return jb.localeCompare(ja) || ob.localeCompare(oa, "fr", { numeric: true }); // Pokémon puis One Piece, extensions récentes d'abord
  });
  return cles.map((k) => {
    const items = pages.get(k).sort((a, b) => Number(b.prix_actuel ?? 0) - Number(a.prix_actuel ?? 0));
    const x0 = items[0];
    const somme = items.reduce((s, x) => s + Number(x.valeur ?? 0), 0);
    return `<section class="page">
      <div class="page-titre"><h3>${esc(x0.extension ?? "Divers")}</h3><span class="code">${esc(x0.extension_code ?? "")}</span><span class="somme">${euro(somme, 0)}</span></div>
      <div class="pochettes">${items.map((x) => pochette(x, avecAchat)).join("")}</div>
    </section>`;
  }).join("");
}

function dessinerClasseur() {
  const liste = filtrer(etat.collection);
  $("#classeur").innerHTML = liste.length
    ? grouper(liste, true)
    : `<p class="vide">Rien ne correspond à ces filtres. Essaie « Tout » ou une autre recherche.</p>`;
}

document.querySelectorAll(".puces").forEach((g) => g.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  etat.filtres[g.dataset.filtre] = b.dataset.val;
  dessinerClasseur();
}));
$("#recherche").addEventListener("input", (e) => { etat.recherche = e.target.value; dessinerClasseur(); });
$("#tri").addEventListener("change", (e) => { etat.tri = e.target.value; dessinerClasseur(); });

/* ---------------- Onglets ---------------- */
document.querySelectorAll(".onglet").forEach((o) => o.addEventListener("click", () => {
  document.querySelectorAll(".onglet").forEach((x) => x.toggleAttribute("aria-current", x === o));
  document.querySelectorAll(".onglet[aria-current]").forEach((x) => x.setAttribute("aria-current", "page"));
  $("#vue-collection").hidden = o.dataset.vue !== "collection";
  $("#vue-equipage").hidden = o.dataset.vue !== "equipage";
  if (o.dataset.vue === "equipage") chargerEquipage();
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
  const tri = [...parMembre.entries()].sort((a, b) => b[1].valeur - a[1].valeur);
  $("#membres").innerHTML = tri.map(([p, m]) => `<li><button data-pseudo="${esc(p)}" aria-pressed="${p === etat.membreChoisi}">
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
  $("#vitrine").innerHTML = etat.membreChoisi ? grouper(liste, false) : "";
}

/* ---------------- Fiche ---------------- */
document.addEventListener("click", async (e) => {
  const p = e.target.closest(".pochette"); if (!p) return;
  const id = Number(p.dataset.id), defaut = p.dataset.defaut === "true";
  const x = etat.collection.find((y) => y.produit_id === id && y.defaut === defaut)
         ?? etat.vitrine.find((y) => y.produit_id === id && y.defaut === defaut);
  if (!x) return;
  const { data: hist } = await sb.from("prix").select("le, prix, source, valide, detail")
    .eq("produit_id", id).eq("etat_prix", defaut ? "defaut" : "standard").order("le");
  const valides = (hist ?? []).filter((h) => h.valide);
  const suspect = (hist ?? []).filter((h) => !h.valide).at(-1);
  const sources = { airtable: "relevé Airtable", api_fr: "Cardmarket FR (automatique)", manuel: "saisie manuelle" };
  const mien = etat.collection.includes(x);
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
      <dt>Prix actuel</dt><dd>${euro(x.prix_actuel)}</dd>
      <dt>Quantité</dt><dd>${x.quantite}</dd>
      <dt>Valeur</dt><dd>${euro(x.valeur)}</dd>
      ${mien && x.prix_achat != null ? `<dt>Payé</dt><dd>${euro(x.prix_achat)} l'unité${x.quantite > 1 ? " en moyenne" : ""}</dd><dt>Plus-value</dt><dd class="${x.benefice >= 0 ? "evo positif" : "evo negatif"}">${euro(x.benefice)} (${pct(x.evolution_pct)})</dd>` : ""}
      ${mien && x.prix_achat == null && x.categorie === "carte" ? `<dt>Origine</dt><dd>Tirée d'un booster 🎁</dd>` : ""}
      <dt>Source</dt><dd>${esc(sources[x.prix_source] ?? x.prix_source ?? "—")}${x.prix_date ? `, le ${new Date(x.prix_date).toLocaleDateString("fr-FR")}` : ""}</dd>
    </dl>
    ${suspect ? `<p class="alerte">Prix en attente de confirmation : ${euro(suspect.prix)} le ${new Date(suspect.le).toLocaleDateString("fr-FR")}. Il sera pris en compte s'il se confirme au prochain relevé.</p>` : ""}
    ${courbe(valides)}
    ${x.lien_cardmarket ? `<p><a href="${esc(x.lien_cardmarket)}" target="_blank" rel="noopener">Voir les offres FR sur Cardmarket</a></p>` : ""}`;
  $("#fiche").showModal();
});

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

/* ---------------- Installation (PWA) ---------------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
