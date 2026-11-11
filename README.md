# PokeVibes

Le classeur de L'Équipage : chacun suit sa collection TCG (Pokémon et One Piece, cartes et scellé) et sa valeur au prix Cardmarket FR.

- Site installable (PWA) : ouvre-le sur ton téléphone, puis « Ajouter à l'écran d'accueil ».
- Connexion par lien envoyé par e-mail.
- Les prix sont relevés automatiquement chaque nuit.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page (connexion, collection, Classeur, Équipage, badges, fiche) |
| `style.css` | L'apparence (iPhone d'abord, puis tablette et PC à partir de 700 et 900 px) |
| `app.js` | Le point d'entrée : charge les modules et les démarre |
| `js/` | Un module ES par domaine (voir ci-dessous), sans framework ni build |
| `badges.js` | Les 30 badges : un seul objet de configuration et leurs dessins |
| `config.js` | L'adresse de la base Supabase et sa clé publique |
| `sw.js`, `manifest.webmanifest`, `icons/` | Ce qui rend le site installable et utilisable hors ligne |
| `tests/` | Tests automatiques des calculs (`node --test`) |

### Modules (`js/`)

Calculs purs, sans page ni réseau (testés) :

| Module | Rôle |
|---|---|
| `prix.js` | Valeur totale, plus-value, fusion des achats, tendance 30 jours, courbe des prix et sa bulle |
| `suivi.js` | Wishlist, alertes de prix, historique (périodes, min / max, gain / perte) |
| `comptes.js` | Formulaires de connexion et d'inscription, messages d'erreur en français, ordre des membres |
| `image.js` | Photo d'un produit : taille réduite (1200 px), poids max, chemin dans le stockage |
| `progression.js` | Progression d'une extension du Classeur, règle Collection / Classeur |
| `badges-regles.js` | Conditions des badges, journal (ouverture, scan reconnu / corrigé) |
| `recherche.js` | Recherche locale des cartes (nom, numéro) |
| `format.js` | Mise en forme (euros, pourcentages, dates) |

Modules de la page : `connexion.js` (comptes), `collection.js`, `classeur.js`, `scanner.js`, `fiche.js`, `cartes.js`, `wishlist.js`, `alertes.js`, `courbe.js` (bulle de la courbe), `photo.js` (envoi d'une photo), `equipage.js`, `badges-ui.js`, `animations.js`, `navigation.js`, `theme.js`, `catalogue.js`, avec `commun.js` (utilitaires de page) et `etat.js` (Supabase et état partagé). Chacun expose une fonction `init…()` appelée une fois par `app.js`.

### Version

Tous les fichiers sont chargés avec `?v=N` (même numéro partout) et listés dans `COQUILLE` de `sw.js`. À chaque mise en ligne, monter `VERSION` dans `sw.js` et le `?v=` partout ; `tests/modules.test.js` vérifie que rien n'a été oublié.

## Tests

```bash
node --test tests/
```

Aucune dépendance à installer (Node 20 ou plus). Les tests couvrent la valeur totale, le gain / la perte, la tendance 30 jours, la progression du Classeur, la règle Collection / Classeur, les conditions des 34 badges, la recherche locale, la Wishlist et les alertes, les messages des comptes, la réduction des photos, la bulle de la courbe, et la structure du site (imports, versions, service worker).

La sécurité est assurée par la base (Supabase) : chacun ne voit que sa collection, et la page « L'Équipage » ne montre jamais les prix d'achat.
