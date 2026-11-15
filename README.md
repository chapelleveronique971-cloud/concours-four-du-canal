# Le Four du Canal — Concours « Pâtisserie d'hiver »

Prototype de **niveau 2** : une landing page d'inscription et un outil d'organisation (participants, notes du jury, classement).
Le cahier des charges est dans [CADRAGE.md](CADRAGE.md). Les choix marqués **[H]** sont des hypothèses à valider avec la cliente.

**URL de démo :** https://concours-four-du-canal.netlify.app (outil : https://concours-four-du-canal.netlify.app/outil.html)

**Prototype de démonstration : à ne pas utiliser en l'état avec de vrais participants.**

## Contenu du projet

| Dossier ou fichier | Rôle |
|---|---|
| `site/index.html` | Page publique du concours et formulaire d'inscription |
| `site/outil.html` | Espace organisation (connexion gérante / équipe / juré) |
| `site/js/config.js` | **Seul réglage** : adresse et clé publique Supabase, informations du concours |
| `supabase/01_schema.sql` | Tables, règles d'accès par rôle, fonctions (inscription, classement…) |
| `supabase/02_seed.sql` | Critères et comptes de démonstration |
| `docs/verifications.md` | Résultats des 5 vérifications du cadrage |
| `docs/methodologie-landing.md` | Application de la méthode du cours (AIDA, unicité, Cialdini) |
| `tests/` | Tests automatiques de la base et serveur de test local |

**Technique** : HTML, CSS et JavaScript, sans outil de construction. **Supabase** (offre gratuite) gère la base de données et la connexion. Hébergement statique : **Netlify** (offre gratuite).

## Lancer le projet

### 1. Base de données (une seule fois)
1. Créer un projet sur supabase.com.
2. Dans **SQL Editor**, exécuter `supabase/01_schema.sql`, puis `supabase/02_seed.sql`. Si Supabase signale des « opérations destructives », c'est à cause des lignes `drop … if exists` : sur une base neuve, on peut confirmer sans risque.
3. Dans **Project Settings → API Keys**, copier l'URL du projet et la clé publique (`sb_publishable_…`, ou `anon` dans les anciennes clés), puis les coller dans `site/js/config.js`. *Ne jamais y mettre la clé secrète.*

### 2. Voir le site sur son ordinateur
Il faut Node.js installé :
```bash
cd tests && npm install && REEL=1 PORT=8080 node serveur-local.mjs
```
Puis ouvrir http://localhost:8080, ou http://localhost:8080/outil.html pour l'outil.

### 3. Mettre en ligne (URL de démo)
Aller sur **app.netlify.com/drop** (après avoir créé un compte gratuit), puis glisser-déposer le dossier **`site`**. Netlify donne aussitôt une adresse du type `https://xxxx.netlify.app`, modifiable dans *Site configuration → Change site name*.
Pour mettre à jour le site : *Deploys* → glisser à nouveau le dossier `site`.

### Comptes de démonstration (fictifs)
| Rôle | E-mail |
|---|---|
| Gérante | `gerante@fourducanal.test` |
| Équipe | `equipe@fourducanal.test` |
| Jurés | `jure1@…`, `jure2@…`, `jure3@fourducanal.test` |

Le mot de passe commun n'est **pas publié** dans le dépôt : il est communiqué séparément (fichier local `supabase/mot-de-passe-demo.txt`, non versionné). Pour une nouvelle installation, remplacer `MOT_DE_PASSE_DEMO` dans `supabase/02_seed.sql` avant de l'exécuter.

### Tests automatiques
```bash
cd tests && npm install && npm run test-base
```
Ils lancent 33 tests sur une copie locale de la base (sans toucher à Supabase).

## Ce qui fonctionne réellement

**Page publique**
- Présentation du concours : date, lieu, thème, principe, barème, règlement, réponses aux hésitations.
- Formulaire avec vérifications et messages d'erreur précis, champ par champ. Les mêmes vérifications sont refaites par le serveur.
- Refus des doublons d'e-mail (majuscules comprises) et de la 21ᵉ inscription. Compteur réel de places restantes ; un désistement libère une place.
- Consentements séparés, non pré-cochés (règlement, données, droit à l'image facultatif), avec mention RGPD.
- Message de succès et **aperçu** de l'e-mail de confirmation.
- Affichage adapté au téléphone (vérifié à 375 px).

**Outil d'organisation** (accès par e-mail et mot de passe ; droits appliqués par la base, pas seulement par l'écran)
- **Équipe** : liste des participants, recherche, filtre, compteurs, pointage Inscrit / Présent / Désisté.
- **Juré** : notation de 0 à 10 par critère des créations pointées « présentes », sous un numéro anonyme. Il ne voit ni les noms, ni les coordonnées, ni les notes des autres jurés.
- **Gérante** : tout ce que voit l'équipe, plus la suppression d'une inscription, le classement calculé automatiquement (pondération, moyenne des jurés, départage par le Goût, mention « ex æquo : décision du jury »), le détail des notes pour vérification et les aperçus des e-mails de confirmation et de rappel.

Résultats des 5 vérifications : tous conformes, voir [docs/verifications.md](docs/verifications.md).

## Limites (ce qui n'est pas fait)

- **Aucun e-mail n'est envoyé** : leur contenu est seulement affiché, avec la mention « non envoyé ». Le lien de désinscription n'existe pas encore (prévu en V2).
- **Modifier une fiche participant ou un critère** se fait dans Supabase (*Table Editor*) : il n'y a pas d'écran pour cela dans l'outil.
- **Mot de passe oublié** : pas de réinitialisation automatique ; elle se fait dans Supabase (*Authentication*).
- **Sécurité de démonstration** : pas de double authentification, pas d'audit de sécurité.
- **Suppression automatique des données** 3 mois après le concours : annoncée dans la mention RGPD, mais à faire à la main (non automatisée).
- Pas de statistiques de visite (elles demanderaient un bandeau cookies), pas de paiement, pas de classement public, une seule catégorie et un seul concours.
- **Informations à fournir par la cliente** : adresse, contact, URL du site WordPress (le lien de retour n'apparaît que lorsqu'elle est renseignée dans `config.js`), noms des jurés, lots.
- Testé avec Chrome (à 375 px et en grand écran), mais pas sur un vrai téléphone.

## Choix faits en dehors du cadrage (validés ou à valider)

- **Numéro de dossard** anonyme pour que les jurés notent sans voir les noms.
- **Allergènes obligatoires** (« aucun » accepté), puisque les jurés goûtent.
- **Seuls les participants pointés « présents »** sont proposés à la notation. Seuls ceux notés par les 3 jurés sont classés ; les autres apparaissent comme « notation incomplète ».
- **Un désistement libère une place** dans la jauge.
- **Ajouts à la page pour suivre la méthode du cours** : sections « Ce que vous allez vivre » et « Vous hésitez encore ? », compteur réel d'inscrits.
