import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import DOMPurify from 'isomorphic-dompurify';
import { euroAmount } from '../utils/subscriptionPricing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.join(__dirname, '../assets/logo.png');
const LOGO_BASE64 = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
  : null;
const logoImg = LOGO_BASE64
  ? `<img src="${LOGO_BASE64}" alt="Aux P'tits Pois" width="70" height="70" style="display: block; margin: 0 auto 15px;">`
  : '';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

const EMAIL_FROM = process.env.EMAIL_FROM || 'Aux P\'tits Pois <noreply@auxptitspois.fr>';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

/* « 1er juillet 2026 ».
   toLocaleDateString écrit « 1 juillet » : le détail passe inaperçu sur une
   date quelconque, mais toutes les échéances de chèques tombent au premier du
   mois, la faute serait donc sur chaque ligne de chaque rappel. Même règle que
   dayMonthYearLong côté frontend, pour que l'email et l'espace adhérent
   disent la même chose de la même façon. */
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const longDate = (value) => {
  const date = new Date(value);
  const jour = date.getDate();
  return `${jour === 1 ? '1er' : jour} ${MOIS[date.getMonth()]} ${date.getFullYear()}`;
};

/* TEMPLATE CSS COMMUN POUR LE FOOTER RGPD */
const footerCSS = `
  .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px; line-height: 1.5; padding: 0 20px; }
  .footer a { color: #6b9d5a; text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
`;

class EmailService {

  /* Envoie un email de bienvenue après inscription */
  async sendWelcomeEmail(user) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Bienvenue chez Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #6b9d5a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                ${footerCSS}
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  ${logoImg}
                  <h1>Bienvenue chez Aux P'tits Pois !</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${escapeHtml(user.firstName)},</p>
                  <p>Merci d'avoir créé votre compte sur Aux P'tits Pois, votre AMAP locale pour des produits frais, bio et de saison.</p>
                  <p>Votre compte est maintenant actif et vous pouvez :</p>
                  <ul>
                    <li>Consulter le panier de la semaine</li>
                    <li>Faire une demande d'abonnement</li>
                    <li>Découvrir nos producteurs locaux</li>
                  </ul>
                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/nos-abonnements" class="button">Découvrir nos abonnements</a>
                  </div>
                  <p>Si vous avez des questions, n'hésitez pas à nous contacter à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${escapeHtml(user.email)} car vous êtes inscrit(e) sur notre plateforme.<br>
                  Conformément au RGPD, vous disposez d'un droit d'accès, de modification et de suppression de vos données. 
                  Pour exercer vos droits, <a href="${process.env.FRONTEND_URL}/compte">accédez à votre espace membre</a>.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      if (process.env.NODE_ENV !== 'production') console.log('[DEV] Email bienvenue envoyé');
      return { success: true };
    } catch (error) {
      console.error('Erreur envoi email bienvenue:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de vérification d'adresse email */
  async sendEmailVerification(user, verifyToken) {
    try {
      const verifyUrl = `${process.env.FRONTEND_URL}/auth/confirm-email/${verifyToken}`;
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Confirmez votre adresse email - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #6b9d5a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                ${footerCSS}
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  ${logoImg}
                  <h1>Confirmez votre email</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${escapeHtml(user.firstName)},</p>
                  <p>Merci de vous être inscrit sur Aux P'tits Pois. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email :</p>
                  <div style="text-align: center;">
                    <a href="${verifyUrl}" class="button">Confirmer mon email</a>
                  </div>
                  <div class="warning"><strong>Attention :</strong> Ce lien est valable pendant 24 heures.</div>
                  <p>Si vous n'avez pas créé de compte, ignorez simplement cet email.</p>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
                    <a href="${verifyUrl}" style="color: #3b82f6; word-break: break-all;">${verifyUrl}</a>
                  </p>
                  <p>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${escapeHtml(user.email)} dans le cadre de votre inscription.<br>
                  Pour gérer vos données personnelles, <a href="${process.env.FRONTEND_URL}/compte">accédez à votre espace membre</a>.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      if (process.env.NODE_ENV !== 'production') console.log('[DEV] Email vérification envoyé');
      return { success: true };
    } catch (error) {
      console.error('Erreur envoi email vérification:', error);
      return { success: false, error: error.message };
    }
  }

  /* Prévient qu'une inscription a été tentée sur une adresse déjà enregistrée.
     Remplace le 409 « cet email existe déjà », qui permettait à un tiers de
     vérifier l'appartenance d'une personne à l'AMAP. Les données affichées
     viennent exclusivement de la base, jamais du formulaire d'inscription :
     sinon n'importe qui pourrait faire arriver le texte de son choix dans la
     boîte mail de l'adhérent. */
  async sendAccountAlreadyExists(user) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Tentative de création de compte - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #6b9d5a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                ${footerCSS}
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  ${logoImg}
                  <h1>Vous avez déjà un compte</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${escapeHtml(user.firstName)},</p>
                  <p>Quelqu'un vient de tenter de créer un compte sur Aux P'tits Pois avec votre adresse email. Un compte existe déjà à cette adresse : aucun nouveau compte n'a été créé et votre mot de passe n'a pas été modifié.</p>
                  <p><strong>Si c'était vous</strong>, connectez-vous simplement avec votre mot de passe habituel :</p>
                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/auth/login" class="button">Me connecter</a>
                  </div>
                  <p>Vous l'avez oublié ? <a href="${process.env.FRONTEND_URL}/auth/forgot-password">Réinitialisez-le en deux minutes</a>.</p>
                  <div class="warning"><strong>Si ce n'était pas vous :</strong> il n'y a rien à faire, votre compte n'a pas été touché. Si ces messages se répètent, écrivez-nous à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</div>
                  <p>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${escapeHtml(user.email)} car un compte existe à cette adresse.<br>
                  Pour gérer vos données personnelles, <a href="${process.env.FRONTEND_URL}/compte">accédez à votre espace membre</a>.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      if (process.env.NODE_ENV !== 'production') console.log('[DEV] Email compte déjà existant envoyé');
      return { success: true };
    } catch (error) {
      console.error('Erreur envoi email compte déjà existant:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de récupération de mot de passe */
  async sendPasswordResetEmail(user, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #c85a3f; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #c85a3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                ${footerCSS}
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  ${logoImg}
                  <h1>Réinitialisation de mot de passe</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${escapeHtml(user.firstName)},</p>
                  <p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte Aux P'tits Pois.</p>
                  <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                  <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
                  </div>
                  <div class="warning"><strong>Attention :</strong> Ce lien est valable pendant 1 heure seulement.</div>
                  <p>Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.</p>
                  <p>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${escapeHtml(user.email)} suite à une demande sur notre site.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      if (process.env.NODE_ENV !== 'production') console.log('[DEV] Email reset password envoyé');
      return { success: true };
    } catch (error) {
      console.error('Erreur envoi email reset password:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de confirmation de demande d'abonnement */
  async sendSubscriptionRequestConfirmation(request) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: request.email,
        subject: 'Demande d\'abonnement reçue - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
                ${footerCSS}
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  ${logoImg}
                  <h1>Demande d'abonnement reçue !</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${escapeHtml(request.firstName)},</p>
                  <p>Nous avons bien reçu votre demande d'abonnement à Aux P'tits Pois.</p>
                  <div class="info-box">
                    <h3 style="margin-top: 0;">Récapitulatif de votre demande :</h3>
                    <p><strong>Type :</strong> ${request.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte (3 mois)'}</p>
                    <p><strong>Panier :</strong> ${request.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}</p>
                    <p><strong>Tarification :</strong> ${request.pricingType === 'NORMAL' ? 'Tarif normal' : 'Tarif solidaire'}</p>
                  </div>
                  <h3>Prochaines étapes :</h3>
                  <ol>
                    <li>Nous étudions votre demande (sous 48h)</li>
                    <li>Nous vous contactons pour valider les informations</li>
                    <li>Vous effectuez le paiement</li>
                    <li>Votre abonnement est activé</li>
                  </ol>
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${escapeHtml(request.email)}.<br>
                  Conformément au RGPD, vous disposez d'un droit d'accès et de modification de vos données. 
                  <a href="${process.env.FRONTEND_URL}/compte">Accédez à votre espace membre</a>.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      if (process.env.NODE_ENV !== 'production') console.log('[DEV] Email confirmation demande envoyé');
      return { success: true };
    } catch (error) {
      console.error('Erreur envoi email confirmation demande:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de confirmation de demande producteur */
  async sendProducerInquiryConfirmation(inquiry) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: inquiry.email,
        subject: 'Candidature reçue - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #5a8a4a 0%, #6b9d5a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                ${footerCSS}
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  ${logoImg}
                  <h1>Candidature reçue !</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${escapeHtml(inquiry.firstName)},</p>
                  <p>Nous avons bien reçu votre candidature pour <strong>${escapeHtml(inquiry.farmName)}</strong> et nous vous recontacterons très prochainement.</p>
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${escapeHtml(inquiry.email)}.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Envoie un message de contact à l'adresse de l'AMAP */
  async sendContactMessage({ name, email, subject, message }) {
    try {
      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const safeSubject = escapeHtml(subject);
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: 'auxptitspois@gmail.com',
        replyTo: email,
        subject: `[Contact] ${String(subject).replace(/[\r\n]+/g, ' ')}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
                .message-box { background: white; border-left: 4px solid #6b9d5a; padding: 20px; border-radius: 0 6px 6px 0; margin: 20px 0; white-space: pre-wrap; }
                ${footerCSS}
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  ${logoImg}
                  <h1>Nouveau message de contact</h1>
                </div>
                <div class="content">
                  <div class="info-box">
                    <p><strong>Nom :</strong> ${safeName}</p>
                    <p><strong>Email :</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
                    <p><strong>Sujet :</strong> ${safeSubject}</p>
                  </div>
                  <p><strong>Message :</strong></p>
                  <div class="message-box">${DOMPurify.sanitize(message, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}</div>
                </div>
                <div class="footer">
                  <p>Ceci est un email automatique généré via le formulaire de contact du site.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Mise en forme du corps d'une newsletter.

     Deux sortes de contenus arrivent ici. Un texte saisi à la main, dont les
     retours à la ligne portent le sens et doivent devenir des <br>. Et du HTML
     déjà mis en forme, comme l'annonce de fermeture, dont les retours à la ligne
     ne sont que de l'indentation : les convertir ajoutait une ligne vide entre
     chaque balise — vingt-cinq pour une annonce de fermeture, dont sept avant le
     premier mot.

     On ne convertit donc que ce qui n'est pas déjà du HTML de bloc. Le test est
     volontairement grossier : la présence d'une balise ouvrante de bloc suffit à
     dire « ce contenu sait déjà se présenter, n'y touche pas ». */
  static formatNewsletterBody(content) {
    const raw = String(content ?? '');
    const looksLikeHtml = /<(p|div|h[1-6]|ul|ol|table|br|section|article)\b/i.test(raw);

    return looksLikeHtml ? raw : raw.replace(/\n/g, '<br>');
  }

  /* Envoie une newsletter */
  async sendNewsletter(newsletter, recipients) {
    try {
      const results = { sent: 0, failed: 0, errors: [] };
      const batchSize = 50;

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        for (const recipient of batch) {
          try {
            await transporter.sendMail({
              from: EMAIL_FROM,
              to: recipient.email,
              subject: newsletter.subject,
              html: `
                <!DOCTYPE html>
                <html lang="fr">
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      body { margin: 0; padding: 0; background-color: #f4f6f3; font-family: Georgia, 'Times New Roman', serif; color: #2d3a2d; }
                      .wrapper { background-color: #f4f6f3; padding: 40px 20px; }
                      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
                      .header { background: linear-gradient(135deg, #5a8a4a 0%, #3d6b30 100%); padding: 36px 40px; text-align: center; }
                      .header img { display: block; margin: 0 auto 16px; max-height: 64px; }
                      .header h1 { margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; }
                      .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; font-style: italic; }
                      .divider { height: 4px; background: linear-gradient(90deg, #a8c87a, #f5c842, #a8c87a); }
                      .content { padding: 40px; font-size: 16px; line-height: 1.75; color: #3a4a3a; }
                      .content p { margin: 0 0 16px; }
                      .footer { background: #f9faf7; border-top: 1px solid #e8ede4; padding: 28px 40px; text-align: center; }
                      .footer p { margin: 0 0 8px; color: #6b7c6b; font-size: 13px; line-height: 1.6; }
                      .footer a { color: #5a8a4a; text-decoration: none; }
                      .footer a:hover { text-decoration: underline; }
                      .footer .unsub { font-size: 12px; color: #9aaa9a; margin-top: 16px; }
                    </style>
                  </head>
                  <body>
                    <div class="wrapper">
                      <div class="container">
                        <div class="header">
                          ${logoImg}
                          <h1>Aux P'tits Pois</h1>
                          <p>AMAP Solidaire</p>
                        </div>
                        <div class="divider"></div>
                        <div class="content">
                          ${DOMPurify.sanitize(EmailService.formatNewsletterBody(newsletter.content))}
                        </div>
                        <div class="footer">
                          <p><strong>Aux P'tits Pois — AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                          <p class="unsub">
                            Vous recevez cet email car vous êtes inscrit(e) sur notre liste de diffusion.<br>
                            <a href="${process.env.FRONTEND_URL}/compte">Gérer mes préférences</a> | 
                            <a href="${process.env.FRONTEND_URL}/compte">Me désabonner</a>
                          </p>
                        </div>
                      </div>
                    </div>
                  </body>
                </html>
              `,
            });
            results.sent++;
          } catch (emailError) {
            results.failed++;
            results.errors.push({ email: recipient.email, error: emailError.message });
          }
        }
        if (i + batchSize < recipients.length) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de confirmation d'abonnement créé */
  async sendSubscriptionConfirmation(subscription, user) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Votre abonnement est activé !',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
                .highlight { background: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6b9d5a; }
                ${footerCSS}
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  ${logoImg}
                  <h1>Bienvenue dans l'aventure !</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${escapeHtml(user.firstName)},</p>
                  <p>Félicitations ! Votre abonnement Aux P'tits Pois est maintenant <strong>activé</strong>.</p>
                  <div class="info-box">
                    <h3 style="margin-top: 0;">Votre abonnement :</h3>
                    <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
                    <p><strong>Type :</strong> ${subscription.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte'}</p>
                    <p><strong>Panier :</strong> ${subscription.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}</p>
                  </div>
                  <div class="highlight">
                    <h3 style="margin-top: 0;">Retrait de votre panier</h3>
                    <p style="margin: 0;"><strong>Chaque mercredi de 18h15 à 19h15</strong><br>
                    ${escapeHtml(subscription.pickupLocation.name)}<br>
                    ${escapeHtml(subscription.pickupLocation.address)}</p>
                  </div>
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${escapeHtml(user.email)} suite à l'activation de votre contrat.<br>
                  <a href="${process.env.FRONTEND_URL}/compte">Accédez à votre espace membre</a>.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Envoie un rappel de renouvellement */
  async sendRenewalReminderEmail(subscription, user) {
    try {
      const type = subscription.type === 'ANNUAL' ? 'Annuel' : 'Découverte';
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Votre abonnement Aux P\'tits Pois expire bientôt',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .warning { background: #fffbeb; border-left: 4px solid #d97706; padding: 14px 18px; border-radius: 4px; margin: 20px 0; }
              .button { display: inline-block; background: #6b9d5a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Votre abonnement expire bientôt</h1>
              </div>
              <div class="content">
                <p>Bonjour ${escapeHtml(user.firstName)},</p>
                <p>Votre abonnement Aux P'tits Pois arrive à échéance dans <strong>30 jours</strong>.</p>
                <div class="info-box">
                  <h3 style="margin-top:0;">Votre abonnement actuel</h3>
                  <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
                  <p><strong>Type :</strong> ${type}</p>
                </div>
                <div class="warning">
                  Sans renouvellement, votre abonnement sera automatiquement clôturé à l'échéance et vous ne recevrez plus de paniers.
                </div>
                <div style="text-align:center;">
                  <a href="${process.env.FRONTEND_URL}/nos-abonnements" class="button">Renouveler mon abonnement</a>
                </div>
                <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${escapeHtml(user.email)}.<br>
                <a href="${process.env.FRONTEND_URL}/compte">Accédez à votre espace membre</a>.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Chèque : avis d'encaissement à venir, envoyé un mois avant le dépôt.

     L'adhérent a signé son contrat en février et remis quatre chèques d'un
     coup ; en juin il ne sait plus lequel part quand, ni s'il en reste. Cet
     avis lui rend cette information au moment où elle sert : avant que la
     banque ne prélève, assez tôt pour approvisionner le compte.

     Le rang du chèque (« 3ᵉ sur 4 ») compte autant que le montant : c'est ce
     qui lui dit combien il en reste après celui-là. */
  async sendChequeDepositNotice({ payment, subscription, user, rang, total }) {
    try {
      const montant = euroAmount(payment.amount);
      const echeance = longDate(payment.dueDate);
      const rangTexte = rang === total
        ? 'Dernier chèque de votre contrat'
        : `${rang}${rang === 1 ? 'er' : 'e'} chèque sur ${total}`;

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: `Votre chèque de ${montant} sera déposé le ${echeance}`,
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b9d5a 0%, #4d7a3d 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .amount { font-size: 26px; font-weight: bold; color: #4d7a3d; }
              .note { background: #fffbeb; border-left: 4px solid #d97706; padding: 14px 18px; border-radius: 4px; margin: 20px 0; }
              .button { display: inline-block; background: #6b9d5a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Un chèque va être déposé</h1>
              </div>
              <div class="content">
                <p>Bonjour ${escapeHtml(user.firstName)},</p>
                <p>Nous vous informons qu'un des chèques remis pour votre abonnement sera porté en banque le <strong>${echeance}</strong>.</p>
                <div class="info-box">
                  <p class="amount" style="margin:0 0 6px;">${montant}</p>
                  <p style="margin:0;">${rangTexte}, abonnement n° ${escapeHtml(subscription.subscriptionNumber)}.</p>
                </div>
                <p>Merci de vérifier que votre compte est approvisionné à cette date. Un chèque rejeté nous oblige à vous recontacter, et engendre des frais pour l'association comme pour vous.</p>
                <div class="note">
                  Ce montant est celui inscrit sur votre contrat. Une suspension de panier ne le modifie pas : l'engagement porte sur la saison entière.
                </div>
                <div style="text-align:center;">
                  <a href="${process.env.FRONTEND_URL}/compte" class="button">Voir mes chèques</a>
                </div>
                <p>Merci de votre soutien,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${escapeHtml(user.email)}.<br>
                <a href="${process.env.FRONTEND_URL}/compte">Accédez à votre espace membre</a>.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Chèques : récapitulatif des dépôts à faire, pour le trésorier.

     Un seul email pour toute la remise, et non un par chèque : la boîte du
     trésorier reçoit une liste qu'il emporte à la banque, pas trente messages
     qu'il finirait par archiver sans lire.

     Les chèques en retard ouvrent la liste et sont marqués : ce sont les seuls
     sur lesquels une action est déjà due. */
  async sendTreasurerChequeDigest(lignes) {
    try {
      const destinataire = process.env.TREASURER_EMAIL;
      if (!destinataire) return { success: false, error: 'TREASURER_EMAIL non configurée' };

      const total = lignes.reduce((somme, ligne) => somme + ligne.amount, 0);
      const retards = lignes.filter((ligne) => ligne.enRetard).length;

      const rangs = lignes.map((ligne) => `
        <tr style="${ligne.enRetard ? 'background:#fef2f2;' : ''}">
          <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0;">
            ${escapeHtml(ligne.nom)}<br>
            <span style="color:#6b7280; font-size:12px;">${escapeHtml(ligne.subscriptionNumber)}</span>
          </td>
          <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; text-align:right; white-space:nowrap;">
            <strong>${euroAmount(ligne.amount)}</strong>
          </td>
          <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; white-space:nowrap;">
            ${longDate(ligne.dueDate)}
            ${ligne.enRetard ? '<br><span style="color:#b91c1c; font-size:12px; font-weight:bold;">en retard</span>' : ''}
          </td>
          <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#6b7280; font-size:13px;">
            ${ligne.checkNumber ? `n° ${escapeHtml(ligne.checkNumber)}` : '—'}
          </td>
        </tr>
      `).join('');

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: destinataire,
        subject: `${lignes.length} chèque${lignes.length > 1 ? 's' : ''} à déposer en banque${retards > 0 ? ` (dont ${retards} en retard)` : ''}`,
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 700px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              table { width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; margin: 20px 0; }
              th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #4b5563; }
              .button { display: inline-block; background: #6b9d5a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Chèques à porter en banque</h1>
              </div>
              <div class="content">
                <p>Bonjour,</p>
                <p>${lignes.length} chèque${lignes.length > 1 ? 's arrivent' : ' arrive'} à échéance. Voici la remise à préparer :</p>
                <table>
                  <thead>
                    <tr><th>Adhérent</th><th style="text-align:right;">Montant</th><th>Échéance</th><th>Chèque</th></tr>
                  </thead>
                  <tbody>${rangs}</tbody>
                  <tfoot>
                    <tr>
                      <td style="padding:12px;"><strong>Total</strong></td>
                      <td style="padding:12px; text-align:right;"><strong>${euroAmount(total)}</strong></td>
                      <td colspan="2"></td>
                    </tr>
                  </tfoot>
                </table>
                <p>Une fois la remise déposée, marquez ces chèques « remis en banque » depuis la fiche de chaque abonnement : c'est ce qui met à jour l'espace de l'adhérent et arrête ce rappel.</p>
                <div style="text-align:center;">
                  <a href="${process.env.FRONTEND_URL}/admin/abonnements" class="button">Ouvrir les abonnements</a>
                </div>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Message automatique destiné à la trésorerie de l'association.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Permanence : Confirmation */
  async sendShiftConfirmation(shift, user) {
    try {
      const date = new Date(shift.distributionDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Confirmation d\'inscription à une permanence - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Inscription confirmée !</h1>
              </div>
              <div class="content">
                <p>Bonjour ${escapeHtml(user.firstName)},</p>
                <p>Votre inscription à la permanence est <strong>confirmée</strong>.</p>
                <div class="info-box">
                  <h3 style="margin-top: 0;">Détails de la permanence :</h3>
                  <p><strong>Date :</strong> ${date}</p>
                  ${shift.startTime ? `<p><strong>Horaire :</strong> ${escapeHtml(shift.startTime)}${shift.endTime ? ` - ${escapeHtml(shift.endTime)}` : ''}</p>` : ''}
                </div>
                <p>Merci pour votre engagement dans l'AMAP !</p>
                <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${escapeHtml(user.email)}.<br>
                <a href="${process.env.FRONTEND_URL}/compte">Accédez à votre espace membre</a>.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Permanence : Annulation */
  async sendShiftCancellation(shift, user) {
    try {
      const date = new Date(shift.distributionDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Permanence annulée - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Permanence annulée</h1>
              </div>
              <div class="content">
                <p>Bonjour ${escapeHtml(user.firstName)},</p>
                <p>Nous vous informons que la permanence à laquelle vous étiez inscrit(e) a été <strong>annulée</strong>.</p>
                <div class="info-box">
                  <h3 style="margin-top: 0;">Permanence concernée :</h3>
                  <p><strong>Date :</strong> ${date}</p>
                </div>
                <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${escapeHtml(user.email)}.<br>
                <a href="${process.env.FRONTEND_URL}/compte">Accédez à votre espace membre</a>.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Abonnement : Annulation */
  async sendSubscriptionCancellation(subscription, user) {
    try {
      const type = subscription.type === 'ANNUAL' ? 'Annuel' : 'Découverte';
      const basket = subscription.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)';
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Votre abonnement Aux P\'tits Pois a été annulé',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Abonnement annulé</h1>
              </div>
              <div class="content">
                <p>Bonjour ${escapeHtml(user.firstName)},</p>
                <p>Nous vous informons que votre abonnement Aux P'tits Pois a été <strong>annulé</strong>.</p>
                <div class="info-box">
                  <h3 style="margin-top: 0;">Abonnement concerné :</h3>
                  <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
                  <p><strong>Type :</strong> ${type}</p>
                  <p><strong>Panier :</strong> ${basket}</p>
                </div>
                <p>Si vous avez des questions ou souhaitez vous réabonner, contactez-nous à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${escapeHtml(user.email)}.<br>
                Conformément au RGPD, vous disposez d'un droit d'accès, de modification et de suppression de vos données personnelles. 
                Pour exercer vos droits, <a href="${process.env.FRONTEND_URL}/compte">accédez à votre espace membre</a>.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Candidature producteur : Acceptée */
  async sendProducerInquiryAccepted(inquiry) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: inquiry.email,
        subject: 'Votre candidature a été acceptée - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Candidature acceptée !</h1>
              </div>
              <div class="content">
                <p>Bonjour ${escapeHtml(inquiry.firstName)},</p>
                <p>Nous avons le plaisir de vous informer que la candidature de <strong>${escapeHtml(inquiry.farmName)}</strong> a été <strong>acceptée</strong> par l'AMAP Aux P'tits Pois.</p>
                <div class="info-box">
                  <h3 style="margin-top: 0;">Prochaines étapes :</h3>
                  <ol style="margin: 0; padding-left: 20px;">
                    <li>Nous vous contacterons prochainement pour organiser une rencontre</li>
                    <li>Nous définirons ensemble les modalités du partenariat</li>
                    <li>Votre exploitation sera présentée à nos adhérents</li>
                  </ol>
                </div>
                <p>Pour toute question, contactez-nous à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${escapeHtml(inquiry.email)} suite à votre candidature.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Candidature producteur : Rejetée */
  async sendProducerInquiryRejected(inquiry) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: inquiry.email,
        subject: 'Votre candidature - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Réponse à votre candidature</h1>
              </div>
              <div class="content">
                <p>Bonjour ${escapeHtml(inquiry.firstName)},</p>
                <p>Nous avons bien étudié la candidature de <strong>${escapeHtml(inquiry.farmName)}</strong> et nous vous remercions de l'intérêt que vous portez à notre AMAP.</p>
                <p>Après examen, nous ne sommes malheureusement pas en mesure de donner suite à votre candidature pour le moment.</p>
                <p>Pour toute question, n'hésitez pas à nous contacter à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                <p>Cordialement,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${escapeHtml(inquiry.email)} suite à votre candidature.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Panier hebdomadaire : Notification aux abonnés actifs (avec batching) */
  async sendWeeklyBasketNotification(basket, recipients) {
    try {
      const results = { sent: 0, failed: 0, errors: [] };
      const batchSize = 50;

      const distDate = new Date(basket.distributionDate).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      const productsHtml = basket.items.map(item => {
        const name = item.product?.name || item.customProductName || 'Produit';
        return `<li style="margin-bottom: 8px;">🥦 ${escapeHtml(name)}</li>`;
      }).join('');

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        for (const recipient of batch) {
          try {
            await transporter.sendMail({
              from: EMAIL_FROM,
              to: recipient.email,
              subject: `Votre panier de la semaine - ${distDate}`,
              html: `
                <!DOCTYPE html>
                <html lang="fr">
                  <head>
                    <meta charset="utf-8">
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                      .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
                      .basket-box { background: white; border: 2px dashed #6b9d5a; padding: 25px; border-radius: 8px; margin: 25px 0; }
                      .basket-title { color: #5a8a4a; margin-top: 0; text-align: center; font-size: 1.2rem; }
                      .product-list { list-style: none; padding: 0; margin: 20px 0 0 0; font-size: 1.1rem; }
                      ${footerCSS}
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        ${logoImg}
                        <h1>Au menu cette semaine !</h1>
                      </div>
                      <div class="content">
                        <p>Bonjour ${escapeHtml(recipient.firstName)},</p>
                        <p>Le panier de la semaine est prêt ! Voici ce que nos producteurs ont récolté pour votre distribution du <strong>${distDate}</strong> :</p>
                        <div class="basket-box">
                          <h3 class="basket-title">Contenu du panier</h3>
                          <ul class="product-list">
                            ${productsHtml}
                          </ul>
                        </div>
                        <p style="font-size: 0.9rem; color: #666; font-style: italic; text-align: center;">
                          (Le contenu peut légèrement varier en fonction des aléas de dernière minute lors de la récolte).
                        </p>
                        <p>N'oubliez pas vos sacs et cabas pour récupérer vos légumes !</p>
                        <p>À mercredi,<br>L'équipe Aux P'tits Pois</p>
                      </div>
                      <div class="footer">
                        <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                        <p>Cet email a été envoyé à ${escapeHtml(recipient.email)} car vous avez un abonnement actif.<br>
                        <a href="${process.env.FRONTEND_URL}/compte">Accédez à votre espace membre</a>.</p>
                      </div>
                    </div>
                  </body>
                </html>
              `,
            });
            results.sent++;
          } catch (emailError) {
            results.failed++;
            results.errors.push({ email: recipient.email, error: emailError.message });
          }
        }

        if (i + batchSize < recipients.length) await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] Notifs paniers envoyées : ${results.sent} succès, ${results.failed} échecs`);
      return { success: true, results };
    } catch (error) {
      console.error('Erreur envoi notifs panier:', error);
      return { success: false, error: error.message };
    }
  }

  /* Permanence : Confirmation de désistement (adhérent) */
  async sendShiftWithdrawal(shift, user) {
    try {
      const date = new Date(shift.distributionDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Désinscription confirmée - Aux P\'tits Pois',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
              ${footerCSS}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>Désinscription confirmée</h1>
              </div>
              <div class="content">
                <p>Bonjour ${escapeHtml(user.firstName)},</p>
                <p>Votre désinscription de la permanence a bien été enregistrée.</p>
                <div class="info-box">
                  <h3 style="margin-top: 0;">Permanence concernée :</h3>
                  <p><strong>Date :</strong> ${date}</p>
                </div>
                <p>Si vous souhaitez vous inscrire à une autre permanence, rendez-vous sur <a href="${process.env.FRONTEND_URL}/permanences">votre espace membre</a>.</p>
                <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${escapeHtml(user.email)}.<br>
                <a href="${process.env.FRONTEND_URL}/compte">Accédez à votre espace membre</a>.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();