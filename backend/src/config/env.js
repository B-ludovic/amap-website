/* Chargement et contrôle de la configuration, avant tout le reste.

   Ce module est importé en premier par server.js. En ESM, les imports sont
   évalués avant le corps du fichier qui les déclare : un dotenv.config() écrit
   dans le corps de server.js s'exécute donc APRÈS que tous les modules importés
   ont été évalués, y compris ceux qui lisent process.env à la construction.
   Placer le chargement ici, dans un module importé en tête, remet les choses
   dans l'ordre : la configuration est en place avant que quoi que ce soit la lise.

   Le contrôle qui suit refuse le démarrage plutôt que d'accepter une
   configuration incomplète. Sans lui, un serveur privé de JWT_SECRET démarre,
   répond 200 sur /api/health, et ne rate que les connexions — la supervision
   voit un service en bonne santé pendant que personne ne peut se connecter. */

import 'dotenv/config';

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes : ${missing.join(', ')}`);
  console.error('   Le serveur ne peut pas démarrer sans elles.');
  process.exit(1);
}
