import { defineConfig } from 'vitest/config';
import { envDeTest } from './vitest.config.js';
import { adresseBaseDeTest } from './tests/helpers/baseDeTest.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.js'],
    globalSetup: ['./tests/helpers/baseDeTest.js'],
    // Une seule base pour tous les fichiers.
    fileParallelism: false,
    env: {
      ...envDeTest,
      DATABASE_URL: adresseBaseDeTest(),
      // config/database.js charge backend/.env : ses secrets n'entrent pas dans la suite.
      BREVO_SMTP_USER: '',
      BREVO_SMTP_KEY: '',
      BREVO_API_KEY: '',
    },
  },
});
