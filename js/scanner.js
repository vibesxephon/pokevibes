/* PokeVibes — Ajout d'une carte ou de scellé : scanner (IA, lecture du numéro), recherche, PC (glisser-déposer, fichier, webcam). */
import { $, avecDelai, calme, esc, euro, NOM_JEU, sansAccent } from "./commun.js?v=15";
import { ajout, etat, sb } from "./etat.js?v=15";
import { ouvrirFiche } from "./fiche.js?v=15";
import { depuisCatalogue } from "./cartes.js?v=15";
import { rechercheLocale } from "./recherche.js?v=15";
import { issueScan } from "./badges-regles.js?v=15";
import { catalogue, chargerIndex, prixConnus, RARETES, setsPokemon, TCG } from "./catalogue.js?v=15";
import { basculerJeu, chargerCollection } from "./collection.js?v=15";
import { chargerClasseur, dessinerClasseurListe, marquerDestination, ouvrirSet, proposerDestination } from "./classeur.js?v=15";
import { noterActivite, verifierBadges } from "./badges-ui.js?v=15";

export function choisirType(t) {
  ajout.type = t; ajout.choix = null;
  $("#ajout-type").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === t)));
  const carte = t === "carte", poke = etat.jeu === "pokemon";
  $("#ajout-carte-pokemon").hidden = !(carte && poke);
  $("#ajout-carte-onepiece").hidden = !(carte && !poke);
  $("#ajout-scelle").hidden = carte;
  $("#bloc-etat").hidden = !carte;
  $("#ajout-final").hidden = carte && poke; // la carte Pokémon s'affiche une fois choisie
  $("#ajout-choix").innerHTML = "";
  $("#bloc-destination").hidden = true;
  ajout.destManuelle = false;
  marquerDestination("collection", "");
}

export async function remplirExtensions() {
  const { data } = await sb.from("extensions").select("id, jeu, code, nom_fr, nom_en, ordre").order("ordre", { ascending: false });
  etat.extensions = data ?? [];
  $("#sc-extension").innerHTML = etat.extensions.filter((e) => e.jeu === etat.jeu)
    .map((e) => `<option value="${e.id}">${esc(e.nom_fr)} (${esc(e.code)})</option>`).join("");
  nomScelle();
}

export function nomScelle() {
  const e = etat.extensions.find((x) => String(x.id) === $("#sc-extension").value);
  const type = $("#sc-type").value, v = $("#sc-variante").value.trim();
  $("#sc-nom").value = `${type} ${e?.code ?? ""}${v ? " " + v : ""}`.trim();
}

export async function chercherCartes(saisie) {
  const q = saisie.trim(); if (!q) return;
  const statut = $("#carte-statut");
  statut.textContent = "Recherche…";
  try {
    let res;
    try { res = rechercheLocale(await chargerIndex(), q); }
    catch { // index indisponible : recherche en ligne, plus limitée
      const m = q.match(/^(TG|GG)?\s*0*(\d{1,3})\s*(?:\/\s*(?:TG|GG)?\s*(\d{1,3}))?$/i);
      if (m) res = await parNumero(m[1] ? `${m[1].toUpperCase()}${m[2].padStart(2, "0")}` : m[2], m[3] ? Number(m[3]) : null);
      else res = await catalogue(`${TCG}/fr/cards?name=${encodeURIComponent(q)}`);
    }
    await afficherResultats(res.slice(0, 120));
    statut.textContent = res.length
      ? `${res.length} carte${res.length > 1 ? "s" : ""} trouvée${res.length > 1 ? "s" : ""}${res.length > 120 ? " (les 120 premières affichées : ajoute un mot pour affiner)" : ""}. Touche la tienne.`
      : "Aucune carte trouvée. Essaie un autre mot, ou le numéro (ex. 221, 221/191).";
  } catch (err) { statut.textContent = `Recherche impossible : ${err.message}`; }
}

export async function parNumero(num, total) {
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
export function vignetteProvisoire(nom, numero, ext) {
  return `<span class="vignette-provisoire"><strong>${esc(nom)}</strong><span>${esc(numero)}</span><span>${esc(ext ?? "")}</span></span>`;
}

export async function afficherResultats(liste) {
  const sets = liste.every((c) => c.set) ? null : await setsPokemon().catch(() => new Map());
  $("#carte-resultats").innerHTML = liste.map((c) => {
    const sid = c.id.slice(0, c.id.lastIndexOf("-"));
    const set = c.set ? { name: c.set.nom, cardCount: { official: c.set.total } } : sets.get(sid);
    const num = `${c.localId}${set?.cardCount?.official ? "/" + set.cardCount.official : ""}`;
    const visuel = c.image ? `<img src="${esc(c.image)}/low.webp" alt="" loading="lazy">` : vignetteProvisoire(c.name, num, set?.name);
    return `<button class="resultat" data-id="${esc(c.id)}">${visuel}<span>${esc(c.name)}</span><span class="infos">${esc(set?.name ?? sid)} · ${esc(num)}</span><span class="prix-tuile" data-prix="${esc(c.id)}"></span></button>`;
  }).join("");
  // Prix déjà connus : affichés dès qu'ils arrivent (« ? » sinon)
  prixConnus(liste.map((c) => c.id)).then((m) => {
    document.querySelectorAll("#carte-resultats .prix-tuile").forEach((el) => {
      const p = m.get(el.dataset.prix);
      el.textContent = p ? euro(p.prix) : "?";
      el.classList.toggle("inconnu", !p);
    });
  }).catch(() => {});
}

export function ressemblance(a, b) {
  const x = new Set(sansAccent(a).split(" ").filter(Boolean)), y = new Set(sansAccent(b).split(" ").filter(Boolean));
  if (!x.size || !y.size) return 0;
  let commun = 0; for (const m of x) if (y.has(m)) commun++;
  return commun / Math.max(x.size, y.size);
}

export async function decoderPhoto(f) {
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

export async function photoReduite(f, max = 1280) {
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

export let scanEnCours = false;

// f : la photo (fichier ou image de la webcam) ; input : le champ à vider une fois la photo lue
export async function scannerPhoto(f, input = null) {
  if (!f || scanEnCours) return;
  scanEnCours = true;
  ajout.scanIA = null;
  noterActivite("scan");
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
    if (input) input.value = ""; // seulement après lecture (sur iPhone, vider avant rend la photo illisible)
    scanEnCours = false;
  }
}

export async function appliquerReconnaissance(r) {
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
    ajout.scanIA = { type: "scelle", sig: signatureScelle() };
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
    ajout.scanIA = { type: "onepiece", sig: i >= 0 ? liste[i].card_name : null };
    return;
  }

  // Pokémon : par numéro d'abord, puis par nom ; la plus ressemblante en premier
  let res = [];
  const num = String(r.numero ?? "").replace(/\s+/g, ""), tot = /^\w*\d+$/.test(String(r.total ?? "")) ? String(r.total) : "";
  try {
    const idx = await chargerIndex();
    if (num) res = rechercheLocale(idx, tot ? `${num}/${tot}` : num);
    if (!res.length && num) res = rechercheLocale(idx, num);
    if (!res.length && r.nom) res = rechercheLocale(idx, r.nom);
  } catch {
    if (num) {
      const brut = num.toUpperCase();
      res = await parNumero(/^(TG|GG|SV)/.test(brut) ? brut : brut.replace(/^0+(?=\d)/, ""), tot ? Number(tot) : null);
    }
    if (!res.length && r.nom) res = await catalogue(`${TCG}/fr/cards?name=${encodeURIComponent(r.nom.split(" ")[0])}`);
  }
  const classe = res.map((c) => ({ c, s: ressemblance(c.name, r.nom) + 0.5 * ressemblance(c.name, r.nom_en) }))
    .sort((a, b) => b.s - a.s).map((x) => x.c).slice(0, 40);
  $("#recherche-carte").value = r.numero ? `${r.numero}${r.total ? "/" + r.total : ""}` : (r.nom ?? "");
  await afficherResultats(classe);
  ajout.scanIA = { type: "pokemon", sig: classe[0]?.id ?? null };
  if (classe.length) {
    $("#carte-statut").textContent = "La première carte est la proposition de l'IA. Si ce n'est pas la bonne, touche la tienne.";
    $("#carte-resultats .resultat")?.click();
  } else $("#carte-statut").textContent = "Aucune carte correspondante dans le catalogue. Cherche par nom ci-dessous.";
}

// Secours sans IA : lecture du numéro en bas de la carte
export let tesseract = null;

export function chargerTesseract() {
  if (tesseract) return tesseract;
  tesseract = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => ok(window.Tesseract); s.onerror = () => ko(new Error("lecteur indisponible"));
    document.head.appendChild(s);
  });
  return tesseract;
}

export function bandeBasse(bitmap, part) {
  const sy = Math.round(bitmap.height * (1 - part)), sh = bitmap.height - sy, k = Math.max(1, 1600 / bitmap.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * k); c.height = Math.round(sh * k);
  const g = c.getContext("2d");
  g.filter = "grayscale(1) contrast(1.8)";
  g.drawImage(bitmap, 0, sy, bitmap.width, sh, 0, 0, c.width, c.height);
  return c;
}

export async function lectureNumero(bmp) {
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

export async function chercherOP(saisie) {
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

// Scan : l'IA propose, on regarde si sa proposition est gardée au moment de valider
export const signatureScelle = () => `${$("#sc-extension").value}|${$("#sc-type").value}`;

export function noterIssueScan() {
  const s = ajout.scanIA; ajout.scanIA = null;
  if (!s) return;
  const choisi = s.type === "scelle" ? (ajout.type === "scelle" ? signatureScelle() : null)
    : s.type === "onepiece" ? ajout.opChoisi ?? null : ajout.choix?.tcgdex_id ?? null;
  noterActivite(issueScan(s.sig, choisi));
}

// Glisser-déposer une image : dans la fenêtre d'ajout, ou n'importe où sur la page (la fenêtre s'ouvre)
export const avecFichiers = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");

// Webcam (si disponible), avec un repli propre si elle est refusée ou absente
export let fluxWebcam = null;

export const webcamPossible = () => !!navigator.mediaDevices?.getUserMedia;

export function arreterWebcam() {
  fluxWebcam?.getTracks().forEach((t) => t.stop());
  fluxWebcam = null;
  $("#webcam-video").srcObject = null;
  $("#webcam").hidden = true;
  $("#bouton-webcam").hidden = !webcamPossible();
}

// Écouteurs et réglages de départ (appelé une fois par app.js)
export function initScanner() {
  $("#bouton-ajouter").addEventListener("click", async () => {
    ajout.choix = null; ajout.scanIA = null; ajout.opChoisi = null;
    arreterWebcam();
    $("#ajout-titre").textContent = `Ajouter à la collection ${NOM_JEU[etat.jeu]}`;
    $("#ajout-message").textContent = "";
    $("#carte-resultats").innerHTML = ""; $("#carte-statut").textContent = "";
    $("#op-resultats").innerHTML = ""; $("#op-statut").textContent = ""; $("#scan-statut").textContent = "";
    $("#aj-quantite").value = 1; $("#aj-prix").value = "";
    choisirType("carte");
    $("#ajout").showModal();
    chargerIndex().catch(() => {}); // en arrière-plan : prêt avant la première recherche
    await remplirExtensions();
  });
  $("#ajout-type").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) choisirType(b.dataset.val); });
  ["#sc-extension", "#sc-type", "#sc-variante"].forEach((s) => $(s).addEventListener("input", nomScelle));
  // --- Recherche de cartes Pokémon ---
  $("#bouton-chercher").addEventListener("click", () => chercherCartes($("#recherche-carte").value));
  $("#recherche-carte").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); chercherCartes(e.target.value); } });
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
      <span class="infos">${esc(fr.set?.name)} · ${esc(ajout.choix.numero)} · ${esc(ajout.choix.rarete ?? "")}</span>${fr.image ? "" : `<br><span class="infos">Image pas encore disponible, elle s'ajoutera toute seule.</span>`}
      <p class="prix-choix" id="prix-choix">Prix Cardmarket FR : …</p>
      <button type="button" class="lien-bouton" id="choix-fiche">Voir la fiche : historique, favori, alerte</button></div>`;
      $("#choix-fiche").addEventListener("click", () => ouvrirFiche(depuisCatalogue({ id: fr.id, name: fr.name, localId: fr.localId, rarete: ajout.choix.rarete,
        set: { nom: fr.set?.name, total: fr.set?.cardCount?.official }, image: fr.image })));
      prixConnus([fr.id]).then((m) => {
        const p = m.get(fr.id), el = $("#prix-choix"); if (!el) return;
        el.innerHTML = p
          ? `Prix Cardmarket FR : <strong>${euro(p.prix)}</strong> <span class="infos">(relevé du ${new Date(p.le).toLocaleDateString("fr-FR")})</span>`
          : `Prix Cardmarket FR : <strong class="inconnu">?</strong> <span class="infos">relevé la nuit prochaine</span>`;
      }).catch(() => { const el = $("#prix-choix"); if (el) el.innerHTML = `Prix Cardmarket FR : <strong class="inconnu">?</strong>`; });
      $("#bloc-destination").hidden = false;
      ajout.destManuelle = false;
      proposerDestination(fr.rarity, null);
      prixConnus([fr.id]).then((m) => { const p = m.get(fr.id); if (p) proposerDestination(fr.rarity, Number(p.prix)); }).catch(() => {});
      $("#ajout-final").hidden = false;
      $("#carte-statut").textContent = "";
      $("#ajout-final").scrollIntoView({ behavior: calme ? "auto" : "smooth", block: "nearest" });
    } catch (err) { $("#carte-statut").textContent = `Carte introuvable : ${err.message}`; }
  });
  $("#scan-photo").addEventListener("change", (e) => scannerPhoto(e.target.files?.[0], e.target));
  // --- One Piece : trouver l'image et le nom par le numéro ---
  $("#op-chercher").addEventListener("click", () => chercherOP($("#op-numero").value));
  $("#op-resultats").addEventListener("click", (e) => {
    const b = e.target.closest(".resultat"); if (!b) return;
    const c = ajout.opListe[Number(b.dataset.i)];
    ajout.opImage = c.card_image; ajout.opChoisi = c.card_name;
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
    } else if (etat.jeu === "pokemon" && ajout.destination === "classeur") {
      if (!ajout.choix) { msg.textContent = "Choisis d'abord ta carte dans la liste."; return; }
      r = await sb.rpc("classeur_modifier", { p_tcgdex_id: ajout.choix.tcgdex_id, p_delta: q });
      if (r.error) { msg.textContent = `Ajout impossible : ${r.error.message}`; return; }
      msg.textContent = "Rangée dans le Classeur ✅";
      noterIssueScan();
      verifierBadges();
      await chargerClasseur();
      if (!$("#vue-classeur").hidden) etat.setOuvert ? ouvrirSet(etat.setOuvert) : dessinerClasseurListe();
      setTimeout(() => $("#ajout").close(), 900);
      return;
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
    noterIssueScan();
    await chargerCollection();
    setTimeout(() => $("#ajout").close(), 900);
  });
  // Scanner sur PC : choisir un fichier
  $("#choisir-fichier").addEventListener("click", () => $("#scan-fichier").click());
  $("#scan-fichier").addEventListener("change", (e) => scannerPhoto(e.target.files?.[0], e.target));
  document.addEventListener("dragover", (e) => {
    if (!avecFichiers(e)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "copy";
    $("#zone-depot").classList.add("survol");
  });
  document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) $("#zone-depot").classList.remove("survol"); });
  document.addEventListener("drop", async (e) => {
    if (!avecFichiers(e)) return;
    e.preventDefault();
    $("#zone-depot").classList.remove("survol");
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    if (!$("#ajout").open) { if (!f) return; $("#bouton-ajouter").click(); await new Promise((r) => setTimeout(r, 50)); }
    if (!f) { $("#scan-statut").textContent = "Ce fichier n'est pas une image. Glisse une photo de la carte (JPG, PNG, HEIC…)."; return; }
    scannerPhoto(f);
  });
  $("#bouton-webcam").hidden = !webcamPossible();
  $("#bouton-webcam").addEventListener("click", async () => {
    const statut = $("#scan-statut");
    try {
      fluxWebcam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false });
      const v = $("#webcam-video");
      v.srcObject = fluxWebcam;
      $("#webcam").hidden = false; $("#bouton-webcam").hidden = true;
      await v.play().catch(() => {});
      statut.textContent = "Tiens la carte bien à plat devant la webcam, puis prends la photo.";
      $("#webcam-photo").focus();
    } catch (err) {
      arreterWebcam();
      console.warn("Webcam indisponible :", err?.name, err?.message);
      statut.textContent = err?.name === "NotAllowedError" || err?.name === "SecurityError"
        ? "Webcam refusée. Pas de souci : glisse une photo de la carte ici, ou choisis un fichier."
        : err?.name === "NotReadableError" || err?.name === "AbortError"
          ? "La webcam est déjà utilisée par une autre application. Ferme-la et réessaie, ou glisse une photo de la carte ici."
          : "Aucune webcam disponible. Glisse une photo de la carte ici, ou choisis un fichier.";
    }
  });
  $("#webcam-photo").addEventListener("click", async () => {
    const v = $("#webcam-video");
    if (!v.videoWidth) { $("#scan-statut").textContent = "La webcam démarre encore, réessaie dans une seconde."; return; }
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.92));
    arreterWebcam();
    if (blob) scannerPhoto(new File([blob], "webcam.jpg", { type: "image/jpeg" }));
  });
  $("#webcam-annuler").addEventListener("click", () => { arreterWebcam(); $("#scan-statut").textContent = ""; });
  $("#ajout").addEventListener("close", arreterWebcam);
}
