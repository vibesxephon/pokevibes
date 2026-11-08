# PokeVibes

Le classeur de L'Équipage : chacun suit sa collection TCG (Pokémon et One Piece, cartes et scellé) et sa valeur au prix Cardmarket FR.

- Site installable (PWA) : ouvre-le sur ton téléphone, puis « Ajouter à l'écran d'accueil ».
- Connexion par lien envoyé par e-mail.
- Les prix sont relevés automatiquement chaque nuit.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page (connexion, collection, Équipage, fiche) |
| `style.css` | L'apparence. Les animations arcade se rangent dans la dernière section |
| `app.js` | Le fonctionnement : lecture de la base, filtres, totaux |
| `config.js` | L'adresse de la base Supabase et sa clé publique |
| `sw.js`, `manifest.webmanifest`, `icons/` | Ce qui rend le site installable |

La sécurité est assurée par la base (Supabase) : chacun ne voit que sa collection, et la page « L'Équipage » ne montre jamais les prix d'achat.
