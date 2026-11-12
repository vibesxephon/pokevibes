/* PokeVibes — « Ajouter ma photo » pour un produit sans image : l'image est réduite (1200 px au plus) et
   compressée en JPEG (moins de 1 Mo) dans le navigateur, envoyée dans le stockage « photos-produits »,
   puis posée sur le produit par definir_photo_produit (refusé si quelqu'un l'a fait entre-temps). */
import { etat, sb } from "./etat.js?v=17";
import { COTE_MAX, POIDS_MAX, QUALITES, dimensionsReduites, cheminPhoto, estImage, messageErreurPhoto } from "./image.js?v=17";

// Lit le fichier (photo de l'appareil ou fichier), tient compte de son orientation
async function decoder(fichier) {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(fichier, { imageOrientation: "from-image" }); } catch {}
  }
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image(); img.decoding = "async"; img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

const enJpeg = (canvas, q) => new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("compression impossible"))), "image/jpeg", q));

// Fichier choisi → { blob JPEG < 1 Mo, largeur, hauteur }
export async function preparerPhoto(fichier) {
  if (!estImage(fichier)) throw new Error("Ce fichier n'est pas une image. Choisis une photo (JPEG, PNG, HEIC…).");
  let img;
  try { img = await decoder(fichier); } catch { throw new Error("Cette image n'a pas pu être lue. Essaie une autre photo ou une capture d'écran."); }
  let cote = COTE_MAX;
  for (let essai = 0; essai < 3; essai++, cote = Math.round(cote * 0.75)) {
    const d = dimensionsReduites(img.width, img.height, cote);
    if (!d) break;
    const canvas = document.createElement("canvas");
    canvas.width = d.largeur; canvas.height = d.hauteur;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, d.largeur, d.hauteur); // fond blanc pour les PNG transparents
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, d.largeur, d.hauteur);
    for (const q of QUALITES) {
      const blob = await enJpeg(canvas, q);
      if (blob.size < POIDS_MAX) { img.close?.(); return { blob, largeur: d.largeur, hauteur: d.hauteur }; }
    }
  }
  img.close?.();
  throw new Error("La photo est trop lourde, même après compression. Essaie une autre photo.");
}

/* Envoi puis pose sur le produit. Renvoie { ok, url, message, deja } ;
   deja : quelqu'un a ajouté une image entre-temps (url est alors la sienne, si on a pu la relire). */
export async function envoyerPhoto(produitId, blob) {
  if (!etat.moi?.id) return { ok: false, message: messageErreurPhoto("non connecté") };
  const chemin = cheminPhoto(etat.moi.id);
  try {
    const envoi = await sb.storage.from("photos-produits").upload(chemin, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (envoi.error) return { ok: false, message: messageErreurPhoto(envoi.error) };
    const { data: url, error } = await sb.rpc("definir_photo_produit", { p_produit_id: produitId, p_chemin: chemin });
    if (error) {
      const deja = /déjà une image|already/i.test(error.message ?? "");
      let autre = null;
      if (deja) autre = (await sb.from("produits").select("image_url").eq("id", produitId).maybeSingle()).data?.image_url ?? null;
      return { ok: false, deja, url: autre, message: messageErreurPhoto(error) };
    }
    return { ok: true, url, message: "Merci ! Ta photo est en ligne : tout L'Équipage la voit maintenant." };
  } catch (e) { return { ok: false, message: messageErreurPhoto(e) }; }
}

// Nombre de photos de produits que j'ai ajoutées (badge « Photographe »)
export async function compterMesPhotos() {
  if (!etat.moi?.id) return 0;
  try {
    const { count, error } = await sb.from("produits").select("id", { count: "exact", head: true }).eq("api_detail->>photo_membre", String(etat.moi.id));
    return error ? 0 : (count ?? 0);
  } catch { return 0; }
}
