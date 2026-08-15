# Tests du backend

Lanceur : [Vitest](https://vitest.dev). Rien à démarrer, aucune base à
provisionner pour les tests unitaires.

```bash
npm test              # la suite entière, une fois
npm run test:watch    # relance à chaque sauvegarde
npm test -- tests/unit/email.mentions.test.js   # un seul fichier
```

## Où va quoi

```
tests/
├── unit/        Une fonction, un module, sans sortie vers le monde extérieur.
│                Ni base de données, ni SMTP, ni réseau : ce qui dépasse est
│                remplacé par un double. C'est le seul type peuplé à ce jour.
├── integration/ Plusieurs modules ensemble, avec une vraie base de test.
│                (vide pour l'instant)
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
| `unit/email.mentions.test.js` | Les mentions obligatoires du pied de page des emails : adresse postale, motif de réception, exercice des droits RGPD. Défaut m7. |
| `unit/email.tracabilite.test.js` | La trace laissée par chaque envoi, réussi ou raté : ligne en base, log qui ne recopie pas l'adresse en production, envoi de masse qui ne s'arrête pas au premier refus. Défaut C2. |
| `unit/newsletter.envoi.test.js` | Le sort de `status` et `sentAt` à l'envoi : relâchés quand rien n'est parti (C3), pris avant la boucle par compare-and-set pour qu'un second clic ne double pas l'envoi (M2), et réponse 202 pendant que la diffusion continue derrière (M10). Vaut aussi pour l'annonce de fermeture. |
| `unit/drapeaux.orphelins.test.js` | Le balayage des drapeaux d'envoi laissés levés par un processus mort : relâchés quand `EmailLog` ne montre aucun envoi réussi, laissés intacts sinon. Défaut m9. |
| `unit/email.delivrabilite.test.js` | Le poids des messages et leur version texte : plus de logo encodé, aucun message près du seuil de troncature de Gmail, en-têtes de désabonnement. Défauts M1 et M7. |
| `unit/panier.publication.test.js` | La publication d'un panier hebdomadaire, qui prévient tous les abonnés actifs : verrou pris en base pour que deux clics croisés ne notifient pas deux fois, gardes du panier introuvable et du panier vide. Le verrou de M2, appliqué au panier. |

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
