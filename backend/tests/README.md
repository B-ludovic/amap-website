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
| `unit/email.mentions.test.js` | Les mentions obligatoires du pied de page des emails : adresse postale, motif de réception, exercice des droits RGPD. Vérifie aussi que l'adresse de contact n'est recopiée nulle part : la suite tourne avec une `CONTACT_EMAIL` de test, toute adresse en dur ressort donc au grand jour. Défauts m7 et m3. |
| `unit/email.tracabilite.test.js` | La trace laissée par chaque envoi, réussi ou raté : ligne en base, log qui ne recopie pas l'adresse en production, envoi de masse qui ne s'arrête pas au premier refus. Défaut C2. |
| `unit/newsletter.envoi.test.js` | Le sort de `status` et `sentAt` à l'envoi : relâchés quand rien n'est parti (C3), pris avant la boucle par compare-and-set pour qu'un second clic ne double pas l'envoi (M2), et réponse 202 pendant que la diffusion continue derrière (M10). Vaut aussi pour l'annonce de fermeture. |
| `unit/annonce-fermeture.rendu.test.js` | Ce que l'adhérent voit d'une annonce de fermeture, lu sur le message remis au transporteur : plus de lignes vides dues à l'indentation du gabarit, plus de classes orphelines ni de second document imbriqué, styles en ligne préservés, motif échappé. La contre-épreuve garde les sauts de ligne d'une lettre écrite au clavier. Défaut M5. |
| `unit/drapeaux.orphelins.test.js` | Le balayage des drapeaux d'envoi laissés levés par un processus mort : relâchés quand `EmailLog` ne montre aucun envoi réussi, laissés intacts sinon. Défaut m9. |
| `unit/email.delivrabilite.test.js` | Ce qui décide du sort d'un message avant qu'on l'ouvre : poids sous le seuil de troncature de Gmail, version texte sans logo encodé, en-têtes de désabonnement, ligne de prévisualisation qui dit autre chose que « Bonjour », table de largeur pour le moteur de Word d'Outlook, et sujets qui ne répètent pas le nom de l'expéditeur. Défauts M1, M7, m4 et m6. |
| `unit/panier.publication.test.js` | La publication d'un panier hebdomadaire, qui prévient tous les abonnés actifs : verrou pris en base pour que deux clics croisés ne notifient pas deux fois, gardes du panier introuvable et du panier vide. Le verrou de M2, appliqué au panier. |
| `unit/panier.notification.test.js` | La notification du panier et sa reprise après un processus mort : qui reste à prévenir se lit dans `EmailLog`, les compteurs se recomptent au lieu de s'additionner, et la reprise n'écrit qu'aux abandonnés — jamais à un panier dont la distribution a déjà eu lieu. Défaut M3. |

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
