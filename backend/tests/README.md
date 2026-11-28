# Tests du backend

Lanceur : [Vitest](https://vitest.dev). Rien à démarrer, aucune base à
provisionner pour les tests unitaires.

```bash
npm test              # la suite unitaire, une fois
npm run test:watch    # relance à chaque sauvegarde
npm test -- tests/unit/email.mentions.test.js   # un seul fichier
npm run test:integration   # tests/integration/, contre la base amap_test
```

## Base des tests d'intégration

`npm test` ne lance jamais `tests/integration/`. Ces fichiers ont leur propre
configuration, `vitest.integration.config.js`, qui vise
`postgresql://localhost:5432/amap_test` ; `TEST_DATABASE_URL` la remplace. Une
base dont le nom ne finit pas par `_test` est refusée au démarrage : le job de
rétention, éprouvé ici, purge la base entière où il tourne.

Préparer la base une fois, puis après chaque nouvelle migration (la CLI Prisma
exige l'utilisateur dans l'adresse, le client de la suite s'en passe) :

```bash
createdb amap_test
DATABASE_URL="postgresql://$(whoami)@localhost:5432/amap_test?schema=public" npx prisma migrate deploy
```

## Où va quoi

```
tests/
├── unit/        Une fonction, un module, sans sortie vers le monde extérieur.
│                Ni base de données, ni SMTP, ni réseau : ce qui dépasse est
│                remplacé par un double.
├── integration/ Plusieurs modules ensemble, avec une vraie base de test.
├── e2e/         L'application entière, par ses routes HTTP. (vide pour l'instant)
├── fixtures/    Les jeux de données partagés : une adhérente, une candidate
│                productrice, un contrat. Aucune assertion ici, seulement des
│                objets.
└── helpers/     L'outillage : doubles, capteurs, petites fabriques. Aucune
                 assertion ici non plus.
```

Le découpage par type n'est pas décoratif : il dit ce qu'un fichier a le droit
de toucher. Un test rangé dans `unit/` qui ouvrirait une connexion Postgres est
au mauvais étage, et le sentir tout de suite évite qu'une suite « unitaire »
devienne lente et capricieuse sans que personne l'ait décidé.

## Ce qui est couvert

| Fichier | Ce qu'il verrouille |
| --- | --- |
| `unit/email.mentions.test.js` | Les mentions obligatoires du pied de page des emails : adresse postale, motif de réception, exercice des droits RGPD. Vérifie aussi que l'adresse de contact n'est recopiée nulle part : la suite tourne avec une `CONTACT_EMAIL` de test, toute adresse en dur ressort donc au grand jour. Défauts m7 et m3. |
| `unit/email.tracabilite.test.js` | La trace laissée par chaque envoi, réussi ou raté : ligne en base, log qui ne recopie pas l'adresse en production, envoi de masse qui ne s'arrête pas au premier refus. Défaut C2. |
| `unit/newsletter.envoi.test.js` | Le sort de `status` et `sentAt` à l'envoi : relâchés quand rien n'est parti (C3), pris avant la boucle par compare-and-set pour qu'un second clic ne double pas l'envoi (M2), et réponse 202 pendant que la diffusion continue derrière (M10). Vaut aussi pour l'annonce de fermeture. |
| `unit/annonce-fermeture.rendu.test.js` | Ce que l'adhérent voit d'une annonce de fermeture, lu sur le message remis au transporteur : plus de lignes vides dues à l'indentation du gabarit, plus de classes orphelines ni de second document imbriqué, styles en ligne préservés, motif échappé. La contre-épreuve garde les sauts de ligne d'une lettre écrite au clavier. Défaut M5. |
| `unit/jobs.planificateur.test.js` | Le planificateur des neuf jobs et sa route : un job ne part qu'une fois par période quel que soit le nombre de réveils ou de passages croisés, la purge attend une heure après un déploiement mais pas après un réveil, une panne est consignée dans `JobRun` sans arrêter les autres jobs, et la route refuse tout appel sans le bon secret. En production, une erreur Prisma n'y laisse que sa première et sa dernière ligne, dans les logs comme dans `JobRun`. |
| `unit/logs.render.test.js` | Ce que Render affiche, c'est-à-dire la sortie standard : chaque action du journal d'audit y laisse une ligne, même quand la base refuse l'écriture, sans email, libellé ni détails ; chaque erreur capturée porte le statut réellement renvoyé et l'identifiant de l'utilisateur ; chaque limiteur signale le premier refus d'une adresse, une fois par fenêtre, sans query string ni jeton. Vérifie aussi qu'aucun module n'importe express-rate-limit hors de la fabrique `limiteur`. Le filtre des messages d'erreur, en production, ne garde d'une erreur Prisma que l'opération et le diagnostic et masque toute adresse e-mail ; aucun log d'erreur du serveur ne le contourne. |
| `unit/requete.corps-invalide.test.js` | Les refus d'`express.json()`, produits par le vrai analyseur : JSON malformé en 400, corps de plus de 100 ko en 413, encodage inconnu en 415, chacun avec un message français au lieu d'une erreur 500. Le log garde le type du refus et jamais le message de V8, qui recopie l'extrait fautif du corps, mot de passe compris. |
| `unit/drapeaux.orphelins.test.js` | Le balayage des drapeaux d'envoi laissés levés par un processus mort : relâchés quand `EmailLog` ne montre aucun envoi réussi, laissés intacts sinon. Défaut m9. |
| `unit/email.delivrabilite.test.js` | Ce qui décide du sort d'un message avant qu'on l'ouvre : poids sous le seuil de troncature de Gmail, version texte sans logo encodé, en-têtes de désabonnement, ligne de prévisualisation qui dit autre chose que « Bonjour », table de largeur pour le moteur de Word d'Outlook, et sujets qui ne répètent pas le nom de l'expéditeur. Défauts M1, M7, m4 et m6. |
| `unit/panier.publication.test.js` | La publication d'un panier hebdomadaire, qui prévient tous les abonnés actifs : verrou pris en base pour que deux clics croisés ne notifient pas deux fois, gardes du panier introuvable et du panier vide. Le verrou de M2, appliqué au panier. |
| `unit/validation.messages.test.js` | Les refus de validation zod : chaque contrôleur qui valide un formulaire renvoie un 400 portant le message français du schéma, pas une erreur 500. Les données acceptées gardent leur forme (nombre vide ramené à undefined, chaîne vide conservée pour effacer un champ, email normalisé), et un `ZodError` levé ressort en 422. Écrit sous zod 3 et resté vert après le passage en zod 4. |
| `unit/panier.notification.test.js` | La notification du panier et sa reprise après un processus mort : qui reste à prévenir se lit dans `EmailLog`, les compteurs se recomptent au lieu de s'additionner, et la reprise n'écrit qu'aux abandonnés — jamais à un panier dont la distribution a déjà eu lieu. Défaut M3. |
| `integration/espace-producteur.cloison.test.js` | La cloison entre deux fermes, par les vrais routeurs : le producteur de la ferme A qui modifie le produit de la ferme B, en demande ou en annule la suppression, corrige ou annule son absence reçoit le même 404 qu'un id inexistant, la ligne reste intacte et un refus `FAILED_PRODUCER_SCOPE_CHECK` est écrit en base. Un `producerId` glissé dans le corps est refusé en 400, sans rien créer. |
| `integration/retention.demande-producteur.test.js` | Un compte non vérifié de plus de trente jours qui porte une demande d'accès producteur survit au job de rétention, avec sa demande ; le même compte sans demande est purgé. |

Un mot sur `helpers/attente.js`, qui revient dans `newsletter.envoi.test.js`. Depuis que
la diffusion quitte la requête, il n'y a plus de promesse à attendre : le test
observe l'état en base jusqu'à ce qu'il change, exactement comme l'écran de
communication en se rafraîchissant. Un `await` sur l'appel du contrôleur ne
prouverait plus rien.

Les deux fichiers partagent `fixtures/messagesSortants.js`, le catalogue des
dix-huit messages du site. Un test de complétude compare ce catalogue à la liste
réelle des expéditeurs du service : un dix-neuvième email ajouté sans entrée au
catalogue fait rougir la suite au lieu de passer inaperçu.

## Conventions

Les variables d'environnement du test vivent dans `vitest.config.js`, jamais
dans `.env` : la suite doit donner le même résultat sur n'importe quelle
machine, et ne jamais faire entrer un secret de production dans une empreinte
calculée par un test.
