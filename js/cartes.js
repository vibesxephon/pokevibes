/* PokeVibes — une carte telle que la fiche et la Wishlist l'affichent, quelle que soit son origine :
   ma collection, la vitrine d'un membre, le catalogue TCGdex (Classeur, recherche) ou un favori.
   Les informations manquantes sont complétées depuis la base (produit, prix actuel, tendance 30 jours). */
import { etat, sb } from "./etat.js?v=15";
import { chargerIndex, prixConnus } from "./catalogue.js?v=15";
import { tendanceDepuisDetail } from "./prix.js?v=15";

// Depuis une ligne de ma collection ou de la vitrine (vue ma_collection / vitrine)
export const depuisProduit = (x) => ({
  produit_id: x.produit_id, tcgdex_id: x.tcgdex_id ?? null, nom: x.nom, numero: x.numero ?? null, extension: x.extension ?? null,
  rarete: x.rarete ?? null, image: x.image_url ?? null, categorie: x.categorie ?? "carte", jeu: x.jeu ?? "pokemon", defaut: !!x.defaut,
  type_scelle: x.type_scelle ?? null, lien_cardmarket: x.lien_cardmarket ?? null,
  prix: x.prix_actuel == null ? null : Number(x.prix_actuel), prix_le: x.prix_date ?? null, prix_source: x.prix_source ?? null, tendance: x.tendance ?? null,
});

// Depuis une carte de l'index TCGdex : { id, localId, name, set: { nom, total }, image }
export const depuisCatalogue = (c) => ({
  produit_id: null, tcgdex_id: c.id, nom: c.name, numero: `${c.localId}${c.set?.total ? `/${c.set.total}` : ""}`, extension: c.set?.nom ?? null,
  rarete: c.rarete ?? null, image: c.image ? `${c.image}/high.webp` : null, categorie: "carte", jeu: "pokemon", defaut: false,
  type_scelle: null, lien_cardmarket: null, prix: null, prix_le: null, prix_source: null, tendance: null,
});

// Prix actuel et tendance d'un produit (lignes de la vue prix_actuel)
function prixDuProduit(lignes, defaut = false) {
  const l = (lignes ?? []).filter((r) => r.etat_prix === (defaut ? "defaut" : "standard")).sort((a, b) => String(b.le).localeCompare(String(a.le)));
  const fr = l.find((r) => r.source === "api_fr");
  return { prix: l[0] ? Number(l[0].prix) : null, prix_le: l[0]?.le ?? null, prix_source: l[0]?.source ?? null, tendance: tendanceDepuisDetail(fr?.detail) };
}

// Complète une carte : produit lié (et inversement l'identifiant du catalogue), prix actuel, tendance
export async function completerCarte(c) {
  try {
    if (c.produit_id != null && c.tcgdex_id == null) {
      const { data } = await sb.from("produits").select("tcgdex_id, lien_cardmarket, rarete").eq("id", c.produit_id).maybeSingle();
      if (data) { c.tcgdex_id = data.tcgdex_id; c.lien_cardmarket ??= data.lien_cardmarket; c.rarete ??= data.rarete; }
    } else if (c.tcgdex_id && c.produit_id == null) {
      const { data } = await sb.from("produits").select("id, lien_cardmarket, rarete, image_url").eq("tcgdex_id", c.tcgdex_id).maybeSingle();
      if (data) { c.produit_id = data.id; c.lien_cardmarket ??= data.lien_cardmarket; c.rarete ??= data.rarete; c.image ??= data.image_url; }
    }
    if (c.produit_id != null && (c.prix == null || c.tendance == null)) {
      const { data } = await sb.from("prix_actuel").select("produit_id, etat_prix, prix, le, source, detail").eq("produit_id", c.produit_id);
      const p = prixDuProduit(data, c.defaut);
      if (c.prix == null && p.prix != null) Object.assign(c, { prix: p.prix, prix_le: p.prix_le, prix_source: p.prix_source });
      c.tendance ??= p.tendance;
    }
    if (c.prix == null && c.tcgdex_id) {
      const p = (await prixConnus([c.tcgdex_id])).get(c.tcgdex_id);
      if (p) Object.assign(c, { prix: Number(p.prix), prix_le: p.le, prix_source: p.source === "catalogue" ? "api_fr" : p.source });
    }
  } catch (e) { console.warn("Carte incomplète :", e?.message ?? e); }
  return c;
}

// Ce que je possède de cette carte : quantité, prix moyen payé, plus-value, et chaque achat (date, prix)
export function possession(c) {
  if (c.produit_id == null) return null;
  const x = (etat.toutes ?? []).find((y) => y.produit_id === c.produit_id && !!y.defaut === !!c.defaut);
  if (!x) return null;
  const achats = (etat.lignes ?? []).filter((l) => l.produit_id === c.produit_id && !!l.defaut === !!c.defaut)
    .map((l) => ({ le: l.achete_le ?? null, prix: l.prix_achat == null ? null : Number(l.prix_achat), quantite: l.quantite ?? 1 }))
    .sort((a, b) => String(b.le ?? "").localeCompare(String(a.le ?? "")));
  return { item: x, quantite: x.quantite, prix_achat: x.prix_achat, benefice: x.benefice, evolution_pct: x.evolution_pct, achats };
}

// Les cartes de la Wishlist, complètes (image, prix, tendance), dans l'ordre des favoris
export async function cartesDesFavoris(favoris) {
  if (!favoris.length) return [];
  const produitDe = new Map();
  const tcgSeuls = [...new Set(favoris.filter((f) => f.produit_id == null && f.tcgdex_id).map((f) => f.tcgdex_id))];
  if (tcgSeuls.length) {
    const { data } = await sb.from("produits").select("id, tcgdex_id").in("tcgdex_id", tcgSeuls);
    for (const p of data ?? []) produitDe.set(p.tcgdex_id, p.id);
  }
  const produitDuFavori = (f) => f.produit_id ?? produitDe.get(f.tcgdex_id) ?? null;
  const ids = [...new Set(favoris.map(produitDuFavori).filter((x) => x != null))];
  const [prods, prix] = ids.length ? await Promise.all([
    sb.from("produits").select("id, nom, numero, rarete, image_url, tcgdex_id, jeu, categorie, type_scelle, lien_cardmarket, extensions(nom_fr)").in("id", ids),
    sb.from("prix_actuel").select("produit_id, etat_prix, prix, le, source, detail").in("produit_id", ids),
  ]) : [{ data: [] }, { data: [] }];
  const produit = new Map((prods.data ?? []).map((p) => [p.id, p]));
  // Cartes du catalogue que personne n'a encore ajoutées : index local + prix relevés la nuit
  const catalogueSeul = favoris.filter((f) => produitDuFavori(f) == null && f.tcgdex_id).map((f) => f.tcgdex_id);
  let idx = null, prixCat = new Map();
  if (catalogueSeul.length) {
    [idx, prixCat] = await Promise.all([chargerIndex().catch(() => null), prixConnus(catalogueSeul).catch(() => new Map())]);
  }
  return favoris.map((f) => {
    const pid = produitDuFavori(f);
    let c;
    if (pid != null && produit.has(pid)) {
      const p = produit.get(pid);
      c = { ...depuisProduit({ ...p, produit_id: p.id, extension: p.extensions?.nom_fr ?? null }), tcgdex_id: p.tcgdex_id ?? f.tcgdex_id ?? null,
        ...prixDuProduit((prix.data ?? []).filter((r) => r.produit_id === pid)) };
    } else {
      const ic = idx?.cartes.find((x) => x.id === f.tcgdex_id);
      c = ic ? depuisCatalogue(ic) : { ...depuisCatalogue({ id: f.tcgdex_id, name: f.tcgdex_id ?? "Carte", localId: "" }), numero: null };
      const pc = prixCat.get(f.tcgdex_id);
      if (pc) Object.assign(c, { prix: Number(pc.prix), prix_le: pc.le });
    }
    return Object.assign(c, { favori_id: f.id, ajoute_le: f.ajoute_le });
  });
}
