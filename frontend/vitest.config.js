import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],

    /* Aucune variable d'environnement n'est posée ici, à dessein : la porte
       d'invitation reçoit sa configuration en argument (readInviteConfig(env)),
       si bien qu'un .env.local traînant sur la machine ne peut ni faire passer
       ni faire échouer la suite. */
  },
});
