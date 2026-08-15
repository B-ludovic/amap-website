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

/* Identifiants du relais SMTP, contrôlés à part parce qu'ils ne bloquent pas le
   même périmètre. Sans eux, email.service.js construit son transporteur avec des
   identifiants undefined : chaque envoi échoue, l'échec est avalé par un catch
   qui renvoie { success: false } sans que personne le lise, et inscription,
   réinitialisation de mot de passe et newsletters se taisent. C'est le piège
   décrit plus haut, appliqué aux emails.

   Exigés seulement en production : y travailler localement sur la pagination
   admin ne devrait pas réclamer une clé Brevo valide. En développement, un
   avertissement bruyant suffit — l'important est de savoir pourquoi rien
   n'arrive, pas d'être empêché de coder. */
const REQUIRED_MAIL_ENV = ['BREVO_SMTP_USER', 'BREVO_SMTP_KEY'];

const missingMail = REQUIRED_MAIL_ENV.filter((key) => !process.env[key]);

if (missingMail.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    console.error(`❌ Identifiants SMTP manquants : ${missingMail.join(', ')}`);
    console.error('   Le serveur refuse de démarrer : aucun email ne partirait.');
    process.exit(1);
  }
  console.warn(`⚠️  Identifiants SMTP manquants : ${missingMail.join(', ')}`);
  console.warn('   Aucun email ne sera envoyé. Voir .env.example pour les récupérer.');
}

/* Adresse du trésorier, destinataire du rappel de dépôt des chèques.
   Même logique que ci-dessus : sans elle le job tourne, trouve les chèques à
   déposer, et envoie son récapitulatif à personne. Personne ne s'en aperçoit
   avant qu'un chèque périmé revienne de la banque six mois plus tard.

   Volontairement pas de repli sur EMAIL_FROM : c'est une adresse d'envoi
   (noreply), écrire au trésorier dessus revient à ne rien envoyer. */
if (!process.env.TREASURER_EMAIL) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ TREASURER_EMAIL manquante.');
    console.error('   Le serveur refuse de démarrer : les rappels de dépôt de chèques n\'arriveraient nulle part.');
    process.exit(1);
  }
  console.warn('⚠️  TREASURER_EMAIL manquante : aucun rappel de dépôt de chèques ne partira.');
}
