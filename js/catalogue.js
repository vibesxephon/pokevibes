/* PokeVibes — Catalogue des cartes (TCGdex / OPTCG via notre relais) et prix déjà connus. */
import { cleNum, sansAccent } from "./commun.js?v=14";
import { etat, sb, SUPABASE_KEY, SUPABASE_URL } from "./etat.js?v=14";

/* ================= Catalogue (TCGdex / OPTCG via notre relais) ================= */
export async function catalogue(url) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/catalogue?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_KEY },
  });
  if (!r.ok) throw new Error(`catalogue indisponible (${r.status})`);
  return r.json();
}

export const TCG = "https://api.tcgdex.net/v2";

export async function setsPokemon() {
  if (!etat.sets) {
    const l = await catalogue(`${TCG}/fr/sets`);
    etat.sets = new Map(l.map((s) => [s.id, s]));
  }
  return etat.sets;
}

export const RARETES = { "illustration rare": "AR", "illustration spéciale rare": "SAR", "hyper rare": "Gold", "ultra rare": "FA", "promo": "Promo" };

/* ================= Index local des cartes Pokémon FR =================
   Toutes les cartes (≈ 20 000) téléchargées une fois (≈ 200 Ko compressés), puis cherchées sur le téléphone :
   sans accents, plusieurs mots-clés, numéro seul (« 191 » = toutes les cartes 191/x et x/191), « nom + numéro »… */
export let indexCartes = null;

export function chargerIndex() {
  if (!indexCartes) {
    indexCartes = (async () => {
      const { data } = await sb.auth.getSession();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/catalogue?index=fr`, {
        headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_KEY },
      });
      if (!r.ok) throw new Error(`index indisponible (${r.status})`);
      const j = await r.json();
      const sets = new Map(j.sets.map(([id, nom, total, ordre]) => [id, { id, nom, total, ordre }]));
      const cartes = j.cartes.map(([id, localId, name, img]) => {
        const set = sets.get(id.slice(0, id.lastIndexOf("-")));
        return { id, localId, name, set, image: img ? (img.startsWith("http") ? img : j.img + img) : null,
          n: cleNum(localId), cle: ` ${sansAccent(`${name} ${set?.nom ?? ""}`)} ` };
      });
      return { sets, cartes };
    })().catch((e) => { indexCartes = null; throw e; });
  }
  return indexCartes;
}

/* ================= Prix déjà connus (pour l'affichage au scan) ================= */
// Prix de la collection d'abord, sinon prix relevé la nuit pour toute l'extension (table prix_catalogue)
export async function prixConnus(ids) {
  const out = new Map();
  if (!ids.length) return out;
  const { data, error } = await sb.rpc("prix_scan", { p_ids: ids });
  if (error) throw error;
  for (const x of data ?? []) out.set(x.tcgdex_id, x);
  return out;
}
