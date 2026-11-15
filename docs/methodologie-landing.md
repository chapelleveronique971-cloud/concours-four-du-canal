# Landing page — application de la méthodologie du cours

Grille du cours (supports « Landing Page », « 3 étapes », « Unicité », « AIDA », « Cialdini », étude de cas Shopify) appliquée à `site/index.html`.
**[H]** = hypothèse à valider avec la cliente (voir CADRAGE.md).

## 1. Objectif de conversion (un seul, chiffré)

- **Conversion unique** : l'inscription au concours (formulaire en bas de page). Tous les boutons de la page y mènent.
- **Objectif chiffré** : 20 inscriptions (jauge) avant le samedi 5 décembre 2026. [H]
- **Mesure** : le nombre d'inscrits est dans la base (outil d'organisation). Pas d'outil d'analytics dans le prototype (il demanderait un bandeau de consentement aux cookies) : prévu en V2.
- **Landing page, pas home page** : pas de menu de navigation, un seul message, un seul objectif. Le lien de retour au site WordPress n'apparaît que lorsque son adresse sera connue.

## 2. Cible (persona) [H]

> Une personne de 25 à 60 ans, habitante du quartier ou cliente de la pâtisserie, qui pâtisse chez elle pour le plaisir, sans formation professionnelle. Elle arrive sur la page depuis le site WordPress du Four du Canal (lien dans le menu ou bandeau en page d'accueil), le plus souvent sur son téléphone. Elle connaît la boutique, mais n'a jamais participé à un concours.

## 3. Tableau des croyances

| Croyance | Barrière (pourquoi elle hésite) | Driver (ce qui la motive) | Réponse sur la page |
|---|---|---|---|
| Sur elle-même | « Je ne suis pas assez douée » | Fierté de montrer ce qu'elle sait faire | « Vous hésitez encore ? » : réservé aux amateurs, pros exclus |
| Sur le concours | « Le jury va me juger, ça m'intimide » | Avoir l'avis de connaisseurs | Notation sous un numéro, barème publié à l'avance |
| Sur son temps / son argent | « Ça va me coûter, c'est compliqué » | Un défi ponctuel, gratuit | « Gratuit », « Quelques minutes », un nom provisoire suffit |
| Sur ses données | « On va revendre mes infos » | — | Données minimales, suppression 3 mois après, mention RGPD |
| Sur son environnement | « Je ne connais personne » | Rencontrer d'autres passionnés | « Un après-midi entre passionnés » |

## 4. Règle de l'unicité

| | Sur la page |
|---|---|
| **Unique lecteur** | Le pâtissier amateur adulte (persona ci-dessus) |
| **Angle unique** | « Pour une fois, faites goûter votre création à un vrai jury, et repartez avec son avis. » |
| **Offre unique** | Une place gratuite au concours du 5 décembre (20 places) |
| **Garantie** | Chaque création est goûtée et notée par 3 jurés, selon un barème publié à l'avance, sous un numéro anonyme |

## 5. Framework AIDA (ordre des sections)

| Étape | Section(s) |
|---|---|
| **Attention** | Haut de page : titre « Pâtisserie d'hiver », gâteau illustré, ticket avec la date, bouton « Je m'inscris » |
| **Intérêt** | Chiffres clés (gratuit, 20 places, 3 jurés, 3 critères), « Le principe », « Comment le jury note » |
| **Désir** | « Ce que vous allez vivre » (bénéfices, pas fonctionnalités) ; compteur réel d'inscrits |
| **Action** | Formulaire avec la promesse réitérée et la réassurance (gratuit, quelques minutes, données minimales, places restantes) ; objections levées dans « Vous hésitez encore ? » |

## 6. Principes de Cialdini

| Principe | Utilisé ? | Comment |
|---|---|---|
| Rareté | Oui | « Plus que X places », compteur en temps réel ; « Complet » quand la jauge est atteinte |
| Preuve sociale | Oui, sans rien inventer | « X pâtissiers amateurs déjà inscrits », chiffre réel lu dans la base |
| Engagement et cohérence | Oui | Formulaire découpé en 3 blocs courts (Vous / Votre création / Accords) |
| Unité | Oui | « Entre passionnés », « pâtissiers amateurs » |
| Autorité | **À compléter** | Présenter les 3 jurés (noms, métiers) : information cliente manquante |
| Sympathie | **À compléter** | Histoire de la pâtisserie, mot de la gérante : information cliente manquante |
| Réciprocité | **À compléter** | Lots ou cadeau de participation : non définis [H] |

**Volontairement exclus** : faux témoignages, faux avis, compte à rebours artificiel. Aucune preuve sociale n'est inventée.

## 7. Bonnes pratiques HTML / CSS du cours

- Structure `<!DOCTYPE html>` / `<head>` / `<body>`, avec les scripts placés juste avant `</body>`.
- Des classes aux noms clairs, en français (`.hero`, `.carte`, `.bouton--hero`, `.reassurance`…). Les identifiants (`#`) ne servent qu'aux éléments uniques et au JavaScript.
- Mise en page en Flexbox et Grid ; tailles de texte en `rem` ou `clamp()`.
- Responsive vérifié à 375 px (téléphone) et 1200 px (ordinateur).
- États visuels : survol, appui (`:active`), focus clavier visible, transitions douces.
- Animation légère (gâteau qui flotte), désactivée si le téléphone demande à réduire les animations.
- **Non appliqué** : la méthodologie Client-First (Finsweet) est propre à Webflow. Ici, le site est écrit directement en code, mais son esprit est respecté : nommage cohérent, styles regroupés, couleurs centralisées dans des variables.

## Informations à demander à la cliente pour renforcer la page

1. Noms et profils des 3 jurés (autorité).
2. Un mot ou l'histoire de la pâtisserie (sympathie).
3. Les lots éventuels (désir, réciprocité).
4. Des photos ou témoignages d'une édition précédente, s'il y en a eu (preuve sociale).
5. L'adresse, le contact et l'URL du site WordPress.
