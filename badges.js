/* PokeVibes — les badges
   Style validé : docs/badges-reference.html (autocollant : liseré blanc épais, contour encre, aplats vifs,
   un reflet blanc, une silhouette différente par badge). Dessins 100 % originaux.

   Pour ajouter un badge : une entrée de plus dans BADGES, rien d'autre à toucher.
   - mesure(d) : un nombre calculé à partir des données du membre (d, voir donneesBadges dans app.js)
   - cible     : le badge est gagné quand mesure(d) >= cible
   - unite     : si présente, la progression s'affiche (« 37 / 50 scans ») ; sinon seule la condition s'affiche
   - secret    : affiché « ??? » tant qu'il n'est pas gagné */

const O = 'stroke="#fff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke"';
const K = 'stroke="#1C1C1C" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
const G = (d) => `<path d="${d}" fill="#fff" opacity=".55"/>`;
// Silhouette : d'abord le liseré blanc de toutes les pièces, puis les pièces à l'encre
const contour = (...els) => `<g ${O}>${els.join("")}</g>`;
const encre = (el) => el.replace(/\/>$/, ` ${K}/>`);
const pieces = (...els) => contour(...els) + els.map(encre).join("");
const etoile = (x, y, r, fill = "#FFF2A8") => `<path d="M${x} ${y - r}l${r * .3} ${r * .7}l${r * .7} ${r * .3}l${-r * .7} ${r * .3}l${-r * .3} ${r * .7}l${-r * .3} ${-r * .7}l${-r * .7} ${-r * .3}l${r * .7} ${-r * .3}z" fill="${fill}"/>`;
const texte = (x, y, t, taille, fill = "#1C1C1C") => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="${taille}" fill="${fill}">${t}</text>`;

const BZ = "#C98A4B", AG = "#C3C7CF", HO = "#F2C200", NUIT = "#3B3F8F";
const CIEL = "#8FD3F0", VERT = "#7BD88F", ROUGE = "#E8574A", CREME = "#F6F6F4", CYAN = "#A8F0FF", MAUVE = "#E3B6FF", PAILLE = "#FFF2A8";

export const RARETES = {
  bronze: { nom: "Bronze", rang: 1 },
  argent: { nom: "Argent", rang: 2 },
  secret: { nom: "Secret", rang: 3 },
  holo: { nom: "Holo", rang: 4 },
};

export const FAMILLES = ["Scanner", "Collection", "Scellé", "Classeur", "Explorateur", "Investisseur", "Secrets"];

// Badge verrouillé (secrets non trouvés)
export const SVG_VERROUILLE = `<rect x="6" y="6" width="48" height="48" rx="14" fill="#5F5F59" ${O}/><rect x="6" y="6" width="48" height="48" rx="14" fill="#5F5F59" ${K}/>${texte(30, 40, "?", 26, "#A8A8A0")}`;

const DESSINS = {
  /* ---------- Scanner ---------- */
  "premier-scan": `<g ${O}><path d="M26 6a20 20 0 1 1 0 40a20 20 0 1 1 0-40z" fill="${BZ}"/><path d="M40 40l14 14" stroke="${BZ}" stroke-width="10" stroke-linecap="round"/></g><path d="M26 6a20 20 0 1 1 0 40a20 20 0 1 1 0-40z" fill="${BZ}" ${K}/><path d="M26 15a11 11 0 1 1 0 22a11 11 0 1 1 0-22z" fill="${CIEL}" ${K}/><path d="M42 42l11 11" stroke="#1C1C1C" stroke-width="8" stroke-linecap="round"/><path d="M42 42l11 11" stroke="${BZ}" stroke-width="4.5" stroke-linecap="round"/>${G("M20 20q4-5 10-4q-6 3-8 8z")}`,
  // Éclair : dix scans d'un coup
  rafale: pieces(`<path d="M35 3L9 34H26L21 57L51 22H33Z" fill="${AG}"/>`) +
    `<path d="M33 12L19 30H30L27 45L42 26H31Z" fill="${HO}" ${K}/>${G("M31 10l-12 15h4l9-11z")}`,
  // Appareil photo
  "scans-50": pieces(`<path d="M18 17l5-8h14l5 8z" fill="${AG}"/>`, `<rect x="4" y="16" width="52" height="36" rx="9" fill="${AG}"/>`) +
    `<circle cx="30" cy="34" r="12" fill="${CIEL}" ${K}/><circle cx="30" cy="34" r="5" fill="${CREME}" ${K}/><rect x="43" y="21" width="7" height="4" rx="1.5" fill="${HO}" ${K} stroke-width="1.5"/>${texte(14, 27, "50", 8)}${G("M23 29q3-5 9-5q-5 3-6 7z")}`,
  // Fusée : deux cent cinquante scans, ça décolle
  "scans-250": pieces(`<path d="M22 41L30 57L38 41Z" fill="${ROUGE}"/>`, `<path d="M20 29L9 45L21 42Z" fill="${MAUVE}"/>`, `<path d="M40 29L51 45L39 42Z" fill="${MAUVE}"/>`, `<path d="M30 3C40 11 43 25 40 42H20C17 25 20 11 30 3Z" fill="${HO}"/>`) +
    `<path d="M26 42L30 51L34 42Z" fill="${PAILLE}"/><circle cx="30" cy="22" r="6" fill="${CYAN}" ${K}/>${texte(30, 38, "250", 7)}${G("M25 11q4-5 6-6q-3 5-3 10z")}`,
  // Œil de lynx : pupille fendue, iris holo
  "oeil-de-lynx": pieces(`<path d="M3 30Q30 4 57 30Q30 56 3 30Z" fill="${HO}"/>`) +
    `<circle cx="30" cy="30" r="13" fill="${CYAN}" ${K}/><path d="M30 17A13 13 0 0 1 43 30H30Z" fill="${MAUVE}" opacity=".85"/><path d="M30 43A13 13 0 0 1 17 30H30Z" fill="${PAILLE}" opacity=".85"/><circle cx="30" cy="30" r="13" fill="none" ${K}/><path d="M30 19Q35 30 30 41Q25 30 30 19Z" fill="#1C1C1C"/>${pieces(etoile(49, 11, 6))}${G("M23 23q3-4 7-4q-4 2-5 6z")}`,

  /* ---------- Collection ---------- */
  // Deux cartes en éventail
  collectionneur: pieces(`<rect x="8" y="9" width="27" height="38" rx="4" fill="#E0B486" transform="rotate(-13 21 28)"/>`, `<rect x="24" y="12" width="27" height="38" rx="4" fill="${BZ}" transform="rotate(9 37 31)"/>`) +
    `<rect x="28" y="16" width="19" height="15" rx="2" fill="${CIEL}" transform="rotate(9 37 31)" ${K}/><path d="M29 36h17M29 41h11" transform="rotate(9 37 31)" fill="none" ${K} stroke-width="1.6"/>${G("M14 14l7-2l-4 10z")}`,
  // Une main de quatre cartes
  "grand-collectionneur": (() => {
    const angles = [-38, -13, 13, 38], couleurs = [MAUVE, CIEL, VERT, ROUGE];
    const carte = (a) => `<rect x="21" y="7" width="18" height="34" rx="3.5" fill="${AG}" transform="rotate(${a} 30 52)"/>`;
    return contour(...angles.map(carte)) + angles.map((a, i) => encre(carte(a)) + `<rect x="24.5" y="11" width="11" height="10" rx="1.5" fill="${couleurs[i]}" transform="rotate(${a} 30 52)" ${K} stroke-width="1.6"/>`).join("") +
      `<circle cx="30" cy="51" r="4" fill="${HO}" ${K}/>${G("M26 12h6l-5 8z")}`;
  })(),
  // Pépite dans sa roche
  "premiere-pepite": pieces(`<path d="M7 40L13 18L30 7L48 13L56 34L44 53H19Z" fill="${AG}"/>`) +
    `<path d="M21 27L32 19L43 28L38 41L25 42Z" fill="${HO}" ${K}/><path d="M32 19L33 31L43 28M33 31L25 42M33 31L38 41" fill="none" ${K} stroke-width="1.5"/>${G("M24 28l7-5l1 7z")}${G("M14 22l6-8l3 2l-7 9z")}`,
  "tresor": `<circle cx="30" cy="30" r="25" fill="${HO}" ${O}/><circle cx="30" cy="30" r="25" fill="${HO}" ${K}/><circle cx="30" cy="30" r="18" fill="none" ${K} stroke-dasharray="3 4"/>${texte(30, 38, "€", 22)}${G("M12 22q5-10 16-11q-10 5-12 14z")}`,

  /* ---------- Scellé ---------- */
  // Booster encore scellé, bords pincés
  "sous-blister": pieces(`<path d="M10 10l4-5l4 5l4-5l4 5l4-5l4 5l4-5l4 5l4-5l4 5V50l-4 5l-4-5l-4 5l-4-5l-4 5l-4-5l-4 5l-4-5l-4 5l-4-5Z" fill="${BZ}"/>`) +
    `<rect x="10" y="15" width="40" height="7" fill="${ROUGE}" ${K}/><path d="M30 26l3 6.5l7 1l-5 5l1.2 7l-6.2-3.3l-6.2 3.3l1.2-7l-5-5l7-1z" fill="${HO}" ${K}/>${G("M14 26h4v16h-4z")}`,
  // Bouclier et cadenas
  "gardien-du-scelle": pieces(`<path d="M30 4L52 12V30C52 44 42 52 30 57C18 52 8 44 8 30V12Z" fill="${AG}"/>`) +
    `<path d="M24.5 29v-5a5.5 5.5 0 0 1 11 0v5" fill="none" ${K} stroke-width="3"/><rect x="20" y="28" width="20" height="16" rx="3.5" fill="${ROUGE}" ${K}/><circle cx="30" cy="34.5" r="2.4" fill="#1C1C1C"/><path d="M30 35v5" stroke="#1C1C1C" stroke-width="2.4" stroke-linecap="round"/>${G("M13 15l13-5v6l-13 5z")}`,

  /* ---------- Classeur ---------- */
  // Une page de classeur, neuf pochettes
  "premiere-page": pieces(`<rect x="8" y="4" width="44" height="52" rx="6" fill="${BZ}"/>`) +
    [[13, 9, CIEL], [25, 9, MAUVE], [37, 9, VERT], [13, 24, ROUGE], [25, 24, "#E8C9A3"], [37, 24, "#E8C9A3"], [13, 39, "#E8C9A3"], [25, 39, "#E8C9A3"], [37, 39, "#E8C9A3"]]
      .map(([x, y, f]) => `<rect x="${x}" y="${y}" width="10" height="13" rx="2" fill="${f}" ${K} stroke-width="1.6"/>`).join("") + G("M11 8h3v18h-3z"),
  // Cadran à moitié rempli
  "mi-parcours": pieces(`<path d="M30 3L54 17V43L30 57L6 43V17Z" fill="${AG}"/>`) +
    `<circle cx="30" cy="30" r="15" fill="${CREME}" ${K}/><path d="M30 15A15 15 0 0 1 30 45Z" fill="${VERT}" ${K}/>${texte(23, 34, "½", 11)}${G("M12 19l12-7v5l-12 7z")}`,
  // Trois extensions de front, chacune à moitié
  "trois-de-front": (() => {
    const livres = [[5, 15, 15, 41, VERT], [22.5, 6, 15, 50, CIEL], [40, 19, 15, 37, MAUVE]];
    return contour(...livres.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.5" fill="${AG}"/>`)) +
      livres.map(([x, y, w, h, f]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.5" fill="${AG}" ${K}/><path d="M${x} ${y + h / 2}h${w}v${h / 2 - 3.5}a3.5 3.5 0 0 1-3.5 3.5h${-(w - 7)}a3.5 3.5 0 0 1-3.5-3.5z" fill="${f}" ${K}/>`).join("") +
      G("M8 19h3v12h-3z") + G("M25.5 10h3v14h-3z");
  })(),
  "master-set": `<path d="M4 12q13-6 26 2q13-8 26-2v40q-13-6-26 2q-13-8-26-2z" fill="${HO}" ${O}/><path d="M4 12q13-6 26 2q13-8 26-2v40q-13-6-26 2q-13-8-26-2z" fill="${HO}" ${K}/><path d="M30 14v40" ${K}/><rect x="9" y="18" width="7" height="10" rx="1.5" fill="${MAUVE}" ${K}/><rect x="18" y="18" width="7" height="10" rx="1.5" fill="${CYAN}" ${K}/><rect x="35" y="18" width="7" height="10" rx="1.5" fill="${VERT}" ${K}/><rect x="44" y="18" width="7" height="10" rx="1.5" fill="${ROUGE}" ${K}/>${G("M8 34q8-4 16 0v4q-8-3-16 0z")}`,
  // Clé des cartes secrètes
  "chasseur-de-secretes": pieces(`<path d="M25 29L29 25L55 51L51 55Z" fill="${HO}"/>`, `<path d="M39 41L45 35L50 40L44 46Z" fill="${HO}"/>`, `<path d="M46 48L51 43L55 47L50 52Z" fill="${HO}"/>`, `<circle cx="19" cy="19" r="15" fill="${HO}"/>`) +
    `<circle cx="19" cy="19" r="8" fill="${MAUVE}" ${K}/>${texte(19, 23.5, "?", 12)}${G("M9 15q3-7 10-8q-6 4-7 10z")}`,
  // Gros classeur à anneaux
  "grand-classeur": pieces(`<rect x="11" y="4" width="44" height="52" rx="6" fill="${HO}"/>`, `<rect x="4" y="12" width="14" height="6" rx="3" fill="${CREME}"/>`, `<rect x="4" y="27" width="14" height="6" rx="3" fill="${CREME}"/>`, `<rect x="4" y="42" width="14" height="6" rx="3" fill="${CREME}"/>`) +
    `<path d="M21 4v52" ${K}/><rect x="26" y="13" width="23" height="14" rx="2.5" fill="${CYAN}" ${K}/>${texte(37.5, 24, "500", 9)}<path d="M26 34h23v12H26z" fill="${MAUVE}" opacity=".75"/><path d="M26 34h23v12H26z" fill="none" ${K} stroke-width="1.6"/>${G("M24 8h4v40h-4z")}`,

  /* ---------- Explorateur ---------- */
  // Globe sur son pied
  "globe-trotteur": pieces(`<rect x="17" y="49" width="26" height="7" rx="3.5" fill="${AG}"/>`, `<rect x="27" y="42" width="6" height="9" fill="${AG}"/>`, `<circle cx="30" cy="25" r="21" fill="${CIEL}"/>`) +
    `<path d="M15 16q6 2 8 8t-4 10q-6-1-7-6M33 10q8 0 12 6q-4 4-9 2q-5-3-3-8M34 33q6-2 9 2q-1 7-7 8q-4-4-2-10" fill="${VERT}" ${K} stroke-width="1.6"/><path d="M9 25a21 21 0 0 0 42 0" fill="none" stroke="${AG}" stroke-width="5"/><path d="M9 25a21 21 0 0 0 42 0" fill="none" ${K} stroke-width="1.6"/>${G("M16 13q5-6 13-7q-7 4-10 10z")}`,
  // Barre de navire (pas de logo, pas de drapeau)
  pirate: (() => {
    const rayon = (a) => `<rect x="27.5" y="3" width="5" height="54" rx="2.5" fill="${BZ}" transform="rotate(${a} 30 30)"/>`;
    const roue = `<path d="M30 11a19 19 0 1 1 0 38a19 19 0 1 1 0-38zM30 17a13 13 0 1 0 0 26a13 13 0 1 0 0-26z" fill="${BZ}" fill-rule="evenodd"/>`;
    return contour(...[0, 45, 90, 135].map(rayon), roue) + [0, 45, 90, 135].map((a) => encre(rayon(a))).join("") + encre(roue) +
      `<circle cx="30" cy="30" r="6" fill="${HO}" ${K}/>${G("M17 22q4-7 11-8v3q-6 2-9 7z")}`;
  })(),
  // Deux casquettes sans logo : une par jeu
  "double-casquette": (() => {
    // Deux casquettes (une par jeu) : calotte colorée à coutures, visière argent, aucun logo
    const cas = (x, y, coul) => {
      const calotte = `<path d="M${x} ${y}a15 15 0 0 1 30 0Z" fill="${coul}"/>`;
      const visiere = `<path d="M${x + 20} ${y - 1}h16a4.5 4.5 0 0 1 0 9H${x + 18}Z" fill="${AG}"/>`;
      return contour(calotte, visiere) + encre(visiere) + encre(calotte) +
        `<path d="M${x + 15} ${y - 15}V${y}M${x + 6} ${y - 11}q3 5 3 11M${x + 24} ${y - 11}q-3 5-3 11" fill="none" ${K} stroke-width="1.4"/><circle cx="${x + 15}" cy="${y - 15}" r="2.4" fill="${AG}" ${K} stroke-width="1.5"/>`;
    };
    return cas(16, 26, CIEL) + cas(3, 47, VERT) + G("M7 42q2-6 8-8q-4 4-5 8z") + G("M20 21q2-6 8-8q-4 4-5 8z");
  })(),

  /* ---------- Investisseur ---------- */
  // Une pousse qui sort du pot
  "premier-gain": pieces(`<path d="M30 24C21 25 14 19 14 9C23 9 30 15 30 24Z" fill="${VERT}"/>`, `<path d="M30 21C30 12 36 5 47 5C47 14 41 21 30 21Z" fill="${VERT}"/>`, `<path d="M17 39H43L39 56H21Z" fill="${BZ}"/>`, `<rect x="13" y="33" width="34" height="8" rx="3" fill="${BZ}"/>`) +
    `<path d="M30 33V20" fill="none" ${K}/>${texte(30, 52, "€", 11)}${G("M17 36h6v3h-6z")}`,
  "bon-flair": `<path d="M30 4L56 30H42V56H18V30H4Z" fill="${AG}" ${O}/><path d="M30 4L56 30H42V56H18V30H4Z" fill="${AG}" ${K}/><path d="M30 14L45 30H36V48H24V30H15Z" fill="${VERT}" ${K}/>${G("M22 30l8-9l3 3l-7 7z")}`,
  sniper: `<circle cx="30" cy="30" r="25" fill="${AG}" ${O}/><circle cx="30" cy="30" r="25" fill="${AG}" ${K}/><circle cx="30" cy="30" r="16" fill="${ROUGE}" ${K}/><circle cx="30" cy="30" r="7" fill="${CREME}" ${K}/><path d="M30 2v12M30 46v12M2 30h12M46 30h12" stroke="#1C1C1C" stroke-width="2.5"/>${G("M14 20q6-9 16-9q-10 4-13 12z")}`,
  "mains-de-diamant": `<path d="M14 6H46L58 22L30 56L2 22Z" fill="${CYAN}" ${O}/><path d="M14 6H46L58 22L30 56L2 22Z" fill="${CYAN}" ${K}/><path d="M2 22H58M14 6L22 22L30 56L38 22L46 6M22 22L30 6L38 22" fill="none" ${K}/><path d="M2 22L22 22L30 56Z" fill="${MAUVE}" opacity=".7"/><path d="M38 22H58L30 56Z" fill="${PAILLE}" opacity=".7"/>${G("M16 9h10l-6 11z")}`,
  // Étiquette de prix
  "premiere-vente": pieces(`<path d="M4 30L22 10H54V50H22Z" fill="${BZ}"/>`) +
    `<circle cx="18" cy="30" r="4" fill="${CREME}" ${K}/>${texte(39, 38, "€", 21)}${G("M24 14h12l-3 4h-12z")}`,
  // Tirelire et sa pièce
  "plus-value": pieces(`<circle cx="30" cy="9" r="7" fill="${HO}"/>`, `<path d="M18 23L22 12L30 21Z" fill="${AG}"/>`, `<rect x="15" y="40" width="8" height="14" rx="3" fill="${AG}"/>`, `<rect x="36" y="40" width="8" height="14" rx="3" fill="${AG}"/>`, `<ellipse cx="29" cy="34" rx="22" ry="16" fill="${AG}"/>`, `<ellipse cx="51" cy="34" rx="5" ry="6" fill="${AG}"/>`) +
    `<rect x="23" y="20" width="12" height="3" rx="1.5" fill="#1C1C1C"/>${texte(30, 12, "+", 9)}<circle cx="42" cy="29" r="2" fill="#1C1C1C"/><circle cx="52" cy="33" r="1.1" fill="#1C1C1C"/><circle cx="52" cy="36" r="1.1" fill="#1C1C1C"/>${G("M13 31q4-8 13-10q-8 5-10 12z")}`,

  /* ---------- Secrets (nuit + jaune) ---------- */
  "oiseau-de-nuit": `<path d="M38 4a26 26 0 1 0 18 34a20 20 0 1 1-18-34z" fill="${NUIT}" ${O}/><path d="M38 4a26 26 0 1 0 18 34a20 20 0 1 1-18-34z" fill="${NUIT}" ${K}/><path d="M46 12l2 5l5 2l-5 2l-2 5l-2-5l-5-2l5-2z" fill="${HO}" ${K} stroke-width="1.5"/>${G("M14 22q4-10 14-13q-8 6-10 15z")}`,
  // Soleil qui se lève sur l'horizon
  "leve-tot": (() => {
    const rayon = (a) => `<rect x="28" y="7" width="4" height="10" rx="2" fill="${HO}" transform="rotate(${a} 30 44)"/>`;
    const angles = [-64, -32, 0, 32, 64];
    return contour(...angles.map(rayon), `<path d="M13 44a17 17 0 0 1 34 0Z" fill="${HO}"/>`, `<rect x="4" y="42" width="52" height="13" rx="5" fill="${NUIT}"/>`) +
      angles.map((a) => encre(rayon(a))).join("") + `<path d="M13 44a17 17 0 0 1 34 0Z" fill="${HO}" ${K}/><rect x="4" y="42" width="52" height="13" rx="5" fill="${NUIT}" ${K}/><path d="M12 48h10M30 49h16" stroke="${CYAN}" stroke-width="2" stroke-linecap="round"/>${G("M19 39q3-7 10-9q-5 4-6 9z")}`;
  })(),
  // Calendrier : trente jours
  fidele: pieces(`<rect x="16" y="3" width="6" height="13" rx="3" fill="${CREME}"/>`, `<rect x="38" y="3" width="6" height="13" rx="3" fill="${CREME}"/>`, `<rect x="6" y="9" width="48" height="47" rx="7" fill="${NUIT}"/>`) +
    `<path d="M6 22V16a7 7 0 0 1 7-7h34a7 7 0 0 1 7 7v6Z" fill="${HO}" ${K}/><rect x="16" y="3" width="6" height="13" rx="3" fill="${CREME}" ${K}/><rect x="38" y="3" width="6" height="13" rx="3" fill="${CREME}" ${K}/>${texte(30, 47, "30", 20, HO)}${G("M10 25h3v20h-3z")}`,
  // Gâteau à une bougie
  "un-an-deja": pieces(`<path d="M30 3c5 5 5 10 0 11c-5-1-5-6 0-11z" fill="${HO}"/>`, `<rect x="26.5" y="13" width="7" height="15" rx="2.5" fill="${CREME}"/>`, `<rect x="7" y="27" width="46" height="28" rx="7" fill="${NUIT}"/>`) +
    `<path d="M7 36V34a7 7 0 0 1 7-7h32a7 7 0 0 1 7 7v2q-5 5-11 0t-12 0t-12 0t-11 0Z" fill="${HO}" ${K}/><path d="M28 17l5-2M28 22l5-2" stroke="${ROUGE}" stroke-width="1.8" stroke-linecap="round"/>${texte(30, 51, "1", 11, HO)}${G("M11 41h3v9h-3z")}`,
};

const jours = (n) => n * 864e5;
// d : voir donneesBadges() dans app.js
export const BADGES = [
  { id: "premier-scan", nom: "Premier scan", famille: "Scanner", rarete: "bronze", condition: "Scanner une carte pour la première fois.", mesure: (d) => d.scans, cible: 1, unite: "scan" },
  { id: "rafale", nom: "Rafale", famille: "Scanner", rarete: "argent", condition: "Faire 10 scans dans la même journée.", mesure: (d) => d.scansJourMax, cible: 10, unite: "scans en un jour" },
  { id: "scans-50", nom: "50 scans", famille: "Scanner", rarete: "argent", condition: "Scanner 50 fois.", mesure: (d) => d.scans, cible: 50, unite: "scans" },
  { id: "scans-250", nom: "250 scans", famille: "Scanner", rarete: "holo", condition: "Scanner 250 fois.", mesure: (d) => d.scans, cible: 250, unite: "scans" },
  { id: "oeil-de-lynx", nom: "Œil de lynx", famille: "Scanner", rarete: "holo", condition: "10 scans reconnus d'affilée, sans jamais corriger l'IA.", mesure: (d) => d.reconnusSuite, cible: 10, unite: "d'affilée" },

  { id: "collectionneur", nom: "Collectionneur", famille: "Collection", rarete: "bronze", condition: "Avoir 50 cartes dans sa collection.", mesure: (d) => d.cartes, cible: 50, unite: "cartes" },
  { id: "grand-collectionneur", nom: "Grand collectionneur", famille: "Collection", rarete: "argent", condition: "Avoir 250 cartes dans sa collection.", mesure: (d) => d.cartes, cible: 250, unite: "cartes" },
  { id: "premiere-pepite", nom: "Première pépite", famille: "Collection", rarete: "argent", condition: "Posséder une carte qui vaut plus de 50 €.", mesure: (d) => (d.prixMax > 50 ? 1 : 0), cible: 1 },
  { id: "tresor", nom: "Trésor", famille: "Collection", rarete: "holo", condition: "Posséder une carte qui vaut plus de 200 €.", mesure: (d) => (d.prixMax > 200 ? 1 : 0), cible: 1 },

  { id: "sous-blister", nom: "Sous blister", famille: "Scellé", rarete: "bronze", condition: "Ajouter son premier produit scellé.", mesure: (d) => d.scelles, cible: 1, unite: "scellé" },
  { id: "gardien-du-scelle", nom: "Gardien du scellé", famille: "Scellé", rarete: "argent", condition: "Garder 10 produits scellés.", mesure: (d) => d.scelles, cible: 10, unite: "scellés" },

  { id: "premiere-page", nom: "Première page", famille: "Classeur", rarete: "bronze", condition: "Ranger 10 cartes dans le Classeur.", mesure: (d) => d.classeurCartes, cible: 10, unite: "cartes" },
  { id: "mi-parcours", nom: "Mi-parcours", famille: "Classeur", rarete: "argent", condition: "Remplir une extension à 50 %.", mesure: (d) => d.meilleurePct, cible: 50, unite: "%" },
  { id: "trois-de-front", nom: "Trois de front", famille: "Classeur", rarete: "argent", condition: "Remplir 3 extensions à 50 %.", mesure: (d) => d.extensions50, cible: 3, unite: "extensions" },
  { id: "master-set", nom: "Master set", famille: "Classeur", rarete: "holo", condition: "Compléter une extension à 100 %.", mesure: (d) => d.meilleurePct, cible: 100, unite: "%" },
  { id: "chasseur-de-secretes", nom: "Chasseur de secrètes", famille: "Classeur", rarete: "holo", condition: "Avoir toutes les cartes secrètes d'une extension.", mesure: (d) => (d.secretesCompletes ? 1 : 0), cible: 1 },
  { id: "grand-classeur", nom: "Grand classeur", famille: "Classeur", rarete: "holo", condition: "Ranger 500 cartes dans le Classeur.", mesure: (d) => d.classeurCartes, cible: 500, unite: "cartes" },

  { id: "globe-trotteur", nom: "Globe-trotteur", famille: "Explorateur", rarete: "argent", condition: "Avoir des cartes de 10 extensions différentes.", mesure: (d) => d.extensions, cible: 10, unite: "extensions" },
  { id: "pirate", nom: "Pirate", famille: "Explorateur", rarete: "bronze", condition: "Ajouter sa première carte One Piece.", mesure: (d) => d.cartesOnePiece, cible: 1, unite: "carte One Piece" },
  { id: "double-casquette", nom: "Double casquette", famille: "Explorateur", rarete: "argent", condition: "Avoir 10 cartes Pokémon et 10 cartes One Piece.", mesure: (d) => Math.min(d.cartesPokemon, d.cartesOnePiece), cible: 10, unite: "de chaque jeu" },

  { id: "premier-gain", nom: "Premier gain", famille: "Investisseur", rarete: "bronze", condition: "Avoir une carte qui vaut plus que son prix d'achat.", mesure: (d) => (d.gainMaxPct > 0 ? 1 : 0), cible: 1 },
  { id: "bon-flair", nom: "Bon flair", famille: "Investisseur", rarete: "argent", condition: "Avoir une carte qui a pris 30 % depuis son achat.", mesure: (d) => Math.max(0, Math.floor(d.gainMaxPct)), cible: 30, unite: "%" },
  { id: "sniper", nom: "Sniper", famille: "Investisseur", rarete: "argent", condition: "Acheter une carte au moins 20 % sous le prix du marché du jour.", mesure: (d) => d.sniper, cible: 1 },
  { id: "mains-de-diamant", nom: "Mains de diamant", famille: "Investisseur", rarete: "holo", condition: "Garder une carte achetée depuis 6 mois.", mesure: (d) => d.detentionJours, cible: 182, unite: "jours" },
  { id: "premiere-vente", nom: "Première vente", famille: "Investisseur", rarete: "bronze", condition: "Enregistrer sa première vente.", mesure: (d) => d.ventes, cible: 1, unite: "vente" },
  { id: "plus-value", nom: "Plus-value", famille: "Investisseur", rarete: "argent", condition: "Vendre plus cher que le prix d'achat, frais compris.", mesure: (d) => d.ventesGagnantes, cible: 1 },

  { id: "oiseau-de-nuit", nom: "Oiseau de nuit", famille: "Secrets", rarete: "secret", secret: true, condition: "Ouvrir PokeVibes entre 2 h et 5 h du matin.", mesure: (d) => (d.heures.some((h) => h >= 2 && h < 5) ? 1 : 0), cible: 1 },
  { id: "leve-tot", nom: "Lève-tôt", famille: "Secrets", rarete: "secret", secret: true, condition: "Ouvrir PokeVibes entre 5 h et 7 h du matin.", mesure: (d) => (d.heures.some((h) => h >= 5 && h < 7) ? 1 : 0), cible: 1 },
  { id: "fidele", nom: "Fidèle", famille: "Secrets", rarete: "secret", secret: true, condition: "Ouvrir PokeVibes 30 jours différents.", mesure: (d) => d.joursOuverture, cible: 30 },
  { id: "un-an-deja", nom: "Un an déjà", famille: "Secrets", rarete: "secret", secret: true, condition: "Ouvrir PokeVibes un an après son inscription.", mesure: (d) => (d.anciennete >= jours(365) ? 1 : 0), cible: 1 },
].map((b) => ({ ...b, dessin: DESSINS[b.id] }));

export const svgBadge = (b, { verrouille = false, label } = {}) =>
  `<svg viewBox="0 0 60 60" role="img" aria-label="${label ?? `Badge ${b.nom}, ${RARETES[b.rarete].nom}`}">${verrouille ? SVG_VERROUILLE : b.dessin}</svg>`;
