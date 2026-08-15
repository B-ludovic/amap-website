import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],

    /* Les variables d'environnement du test sont posées ici, en clair.

       Le backend lit normalement backend/.env au démarrage, par le dotenv que
       charge config/database.js. Une suite de tests qui dépendrait de ce
       fichier passerait ou échouerait selon la machine — et le jour où un
       secret de production traînerait dans un .env local, il entrerait dans les
       empreintes calculées par les tests. Les tests unitaires remplacent donc
       ce module, et les quelques variables dont le rendu a besoin sont
       déclarées ci-dessous, sans valeur ailleurs qu'ici. */
    env: {
      NODE_ENV: 'test',
      FRONTEND_URL: 'https://auxptitspois.test',
      JWT_SECRET: 'jeton-de-test-sans-valeur-hors-de-cette-suite',
      /* Sans elle, le récapitulatif du trésorier refuse de partir : il n'a pas
         de destinataire à qui l'adresser. */
      TREASURER_EMAIL: 'tresorerie@auxptitspois.test',
    },
  },
});
