# Vérifications prévues au CADRAGE — résultats

Date : 14 novembre 2026 (tests complets), 15 novembre 2026 (contrôle sur l'URL en ligne). Environnement : vraie base Supabase du projet, avec la page servie en local (`localhost`), puis l'URL Netlify https://concours-four-du-canal.netlify.app.
Comptes utilisés : comptes de démonstration `@fourducanal.test`.

| # | Vérification | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|
| 1 | Inscription valide | Message de succès ; le participant apparaît dans la liste de l'outil | Message « Merci Camille, votre inscription est enregistrée ! » avec l'aperçu de l'e-mail marqué « non envoyé ». Le compteur passe de 20 à 19 places. Camille Test apparaît (dossard n° 1) dans la liste « Participants » de l'équipe et de la gérante. | ✅ Conforme |
| 2 | Cas d'erreur : champ obligatoire vide, e-mail invalide, e-mail déjà inscrit, jauge atteinte | Message d'erreur précis, aucune inscription créée | **Champ vide** : « Indiquez votre prénom. » (le serveur le refuse aussi s'il est appelé directement : `CHAMP_MANQUANT:prenom`). **E-mail invalide** : « Cette adresse e-mail ne semble pas valide (exemple attendu : prenom.nom@exemple.fr). » **Déjà inscrit** (même e-mail en majuscules) : « Cette adresse e-mail est déjà inscrite au concours… ». Places restantes avant et après ces 3 essais : 17 et 17, donc aucune inscription créée. **Jauge** : base remplie à 20 avec des inscriptions provisoires ; la page affiche « Complet : les 20 places sont attribuées. », masque le formulaire, et une 21ᵉ inscription envoyée directement au serveur est refusée (`COMPLET`). La base compte toujours 20 inscrits. Les 17 inscriptions provisoires ont ensuite été supprimées. | ✅ Conforme |
| 3 | Classement : 3 participants notés par 3 jurés, comparés à un calcul manuel | Notes finales et ordre identiques au calcul manuel | Notes saisies dans l'outil par Juré 1, 2 et 3. Classement de l'outil : **1. Camille 15,50** (Goût 8,00) · **2. Inès 15,50** (Goût 7,33) · **3. Hugo 15,33**. Calcul manuel : voir le détail ci-dessous. Ordre et notes identiques, et l'égalité est bien départagée par le Goût. | ✅ Conforme |
| 4 | Affichage mobile (largeur 375 px) | Page lisible, formulaire utilisable sans zoom | Page publique et outil à 375 px : aucun défilement horizontal (largeur de page = 375 px). Champs en 16 px, donc pas de zoom automatique sur iPhone. Boutons d'au moins 44 à 48 px de haut. La date est visible dès l'ouverture. Les notes se saisissent avec de gros boutons de 0 à 10. | ✅ Conforme (navigateur réglé à 375 px ; pas encore testé sur un vrai téléphone) |
| 5 | Accès à l'outil sans connexion, puis en tant que juré | Accès refusé ; le juré ne voit pas les coordonnées | **Sans connexion** : seul le formulaire de connexion s'affiche ; une lecture directe de la table des participants renvoie « permission denied » ; une suppression directe est refusée. **Mauvais mot de passe** : « Adresse e-mail ou mot de passe incorrect. » **Juré** : onglets « Noter » et « Critères » seulement. Les créations apparaissent sous un n° de dossard, sans nom ni e-mail à l'écran. Une lecture directe de la base renvoie 0 participant, et « ACCES_REFUSE » pour le classement et le changement de statut. Le juré ne voit que ses 9 notes. | ✅ Conforme |

## Contrôle sur l'URL en ligne (15 novembre 2026)

Sur https://concours-four-du-canal.netlify.app, au format téléphone (375 px) :
- Page publique : affichage sans débordement ; compteur réel « 3 pâtissiers amateurs déjà inscrits · 17 places restantes sur 20 », ce qui prouve que la page en ligne lit bien la base.
- Formulaire vide : les 8 messages d'erreur. E-mail invalide : message précis. Doublon (`Camille.Test@exemple.fr`) : refusé par le serveur, aucune confirmation affichée.
- Outil sans connexion : seul le formulaire de connexion s'affiche ; une lecture directe des participants et du classement est refusée (« permission denied »).
- **Non refait en ligne** : les connexions juré, équipe et gérante (vérifications 3 et 5, partie juré). Elles ont été testées sur `localhost` avec la même base. Seule la page change entre les deux, et ses fichiers sont identiques. À rejouer lors de la démonstration avec les comptes de démo.

## Détail du calcul manuel (vérification 3)

Note d'un juré = (Goût × 2 + Aspect + Créativité) / 40 × 20.

| Participant | Juré 1 (G/A/C) | Juré 2 | Juré 3 | Note finale (moyenne) | Moyenne Goût |
|---|---|---|---|---|---|
| Camille (n° 1) | 8/7/9 → 16,00 | 7/8/8 → 15,00 | 9/6/7 → 15,50 | (16 + 15 + 15,5) / 3 = **15,50** | 8,00 |
| Inès (n° 3) | 7/8/8 → 15,00 | 7/9/9 → 16,00 | 8/7/8 → 15,50 | (15 + 16 + 15,5) / 3 = **15,50** | 7,33 |
| Hugo (n° 2) | 9/6/7 → 15,50 | 8/7/6 → 14,50 | 8/8/8 → 16,00 | (15,5 + 14,5 + 16) / 3 = **15,33** | 8,33 |

Camille et Inès sont à égalité (15,50). Camille passe devant grâce à sa meilleure moyenne en Goût (8,00 contre 7,33).

## Tests complémentaires

- **33 tests automatiques de la base** (`tests/test-base.mjs`, sur une copie locale de Postgres) : 33 réussis. Ils couvrent les validations, les doublons, la jauge, la place libérée par un désistement, les droits par rôle et le classement.
- **Équipe** : peut pointer Présent ou Désisté et rechercher ; ne voit ni le classement ni les notes ; n'a pas de bouton de suppression.
- **Gérante** : suppression avec étape de confirmation (bouton Annuler testé).
- **Déconnexion** : la page est rechargée entièrement, et aucune donnée de la session précédente n'y reste.
