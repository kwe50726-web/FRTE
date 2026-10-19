RANKED WORDBOMB - SERVEUR EN LIGNE (gratuit sur Render)

Contenu : server.js (comptes, multijoueur, classement) + public/index.html (le jeu)
Aucun "npm install" necessaire (zero dependance).

=== METTRE EN LIGNE (5 minutes) ===
1. Cree un compte gratuit sur https://github.com et un nouveau depot ("New repository", nom: wordbomb)
2. Clique "uploading an existing file" et glisse TOUT le contenu de ce dossier
   (server.js, package.json, dossier public). Clique "Commit changes".
3. Cree un compte gratuit sur https://render.com (connecte avec GitHub)
4. "New +" > "Web Service" > choisis ton depot "wordbomb"
5. Reglages : Runtime = Node | Build Command = (laisse vide) | Start Command = node server.js
   Instance Type = Free. Clique "Create Web Service".
6. Au bout d'1-2 minutes tu obtiens une adresse du type  https://wordbomb-xxxx.onrender.com
   -> c'est l'adresse de ton jeu. Colle-la dans l'extension (page Options).

=== A SAVOIR ===
- Offre gratuite : le serveur s'endort apres ~15 min sans visiteur (le 1er chargement prend ~1 min).
- Offre gratuite : le disque est effacé quand le serveur redemarre/se met a jour, donc les comptes et
  le classement peuvent etre remis a zero. Pour les garder : disque persistant (payant sur Render)
  avec la variable DATA_DIR pointant vers ce disque.
- Pas d'email de verification (il faudrait un service d'envoi d'emails) : l'email sert d'identifiant.
- Les mots de passe sont stockes hashes (scrypt), jamais en clair.
