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

## Conventions

Les variables d'environnement du test vivent dans `vitest.config.js`, jamais
dans `.env` : la suite doit donner le même résultat sur n'importe quelle
machine, et ne jamais faire entrer un secret de production dans une empreinte
calculée par un test.
