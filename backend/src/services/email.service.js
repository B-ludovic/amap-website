import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import DOMPurify from 'isomorphic-dompurify';

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
                  <p>Bonjour ${user.firstName},</p>
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
                  <p>Cet email a été envoyé à ${user.email} car vous êtes inscrit(e) sur notre plateforme.<br>
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
                  <p>Bonjour ${user.firstName},</p>
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
                  <p>Cet email a été envoyé à ${user.email} dans le cadre de votre inscription.<br>
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
                  <p>Bonjour ${user.firstName},</p>
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
                  <p>Cet email a été envoyé à ${user.email} suite à une demande sur notre site.</p>
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
                  <p>Bonjour ${request.firstName},</p>
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
                  <p>Cet email a été envoyé à ${request.email}.<br>
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
                  <p>Bonjour ${inquiry.firstName},</p>
                  <p>Nous avons bien reçu votre candidature pour <strong>${inquiry.farmName}</strong> et nous vous recontacterons très prochainement.</p>
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${inquiry.email}.</p>
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
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: 'auxptitspois@gmail.com',
        replyTo: email,
        subject: `[Contact] ${subject}`,
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
                    <p><strong>Nom :</strong> ${name}</p>
                    <p><strong>Email :</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Sujet :</strong> ${subject}</p>
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
                          ${DOMPurify.sanitize(newsletter.content.replace(/\n/g, '<br>'))}
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
                  <p>Bonjour ${user.firstName},</p>
                  <p>Félicitations ! Votre abonnement Aux P'tits Pois est maintenant <strong>activé</strong>.</p>
                  <div class="info-box">
                    <h3 style="margin-top: 0;">Votre abonnement :</h3>
                    <p><strong>N° :</strong> ${subscription.subscriptionNumber}</p>
                    <p><strong>Type :</strong> ${subscription.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte'}</p>
                    <p><strong>Panier :</strong> ${subscription.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}</p>
                  </div>
                  <div class="highlight">
                    <h3 style="margin-top: 0;">Retrait de votre panier</h3>
                    <p style="margin: 0;"><strong>Chaque mercredi de 18h15 à 19h15</strong><br>
                    ${subscription.pickupLocation.name}<br>
                    ${subscription.pickupLocation.address}</p>
                  </div>
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                  <p>Cet email a été envoyé à ${user.email} suite à l'activation de votre contrat.<br>
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
                <p>Bonjour ${user.firstName},</p>
                <p>Votre abonnement Aux P'tits Pois arrive à échéance dans <strong>30 jours</strong>.</p>
                <div class="info-box">
                  <h3 style="margin-top:0;">Votre abonnement actuel</h3>
                  <p><strong>N° :</strong> ${subscription.subscriptionNumber}</p>
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
                <p>Cet email a été envoyé à ${user.email}.<br>
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
                <p>Bonjour ${user.firstName},</p>
                <p>Votre inscription à la permanence est <strong>confirmée</strong>.</p>
                <div class="info-box">
                  <h3 style="margin-top: 0;">Détails de la permanence :</h3>
                  <p><strong>Date :</strong> ${date}</p>
                  ${shift.startTime ? `<p><strong>Horaire :</strong> ${shift.startTime}${shift.endTime ? ` - ${shift.endTime}` : ''}</p>` : ''}
                </div>
                <p>Merci pour votre engagement dans l'AMAP !</p>
                <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${user.email}.<br>
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
                <p>Bonjour ${user.firstName},</p>
                <p>Nous vous informons que la permanence à laquelle vous étiez inscrit(e) a été <strong>annulée</strong>.</p>
                <div class="info-box">
                  <h3 style="margin-top: 0;">Permanence concernée :</h3>
                  <p><strong>Date :</strong> ${date}</p>
                </div>
                <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${user.email}.<br>
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
                <p>Bonjour ${user.firstName},</p>
                <p>Nous vous informons que votre abonnement Aux P'tits Pois a été <strong>annulé</strong>.</p>
                <div class="info-box">
                  <h3 style="margin-top: 0;">Abonnement concerné :</h3>
                  <p><strong>N° :</strong> ${subscription.subscriptionNumber}</p>
                  <p><strong>Type :</strong> ${type}</p>
                  <p><strong>Panier :</strong> ${basket}</p>
                </div>
                <p>Si vous avez des questions ou souhaitez vous réabonner, contactez-nous à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${user.email}.<br>
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
                <p>Bonjour ${inquiry.firstName},</p>
                <p>Nous avons le plaisir de vous informer que la candidature de <strong>${inquiry.farmName}</strong> a été <strong>acceptée</strong> par l'AMAP Aux P'tits Pois.</p>
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
                <p>Cet email a été envoyé à ${inquiry.email} suite à votre candidature.</p>
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
                <p>Bonjour ${inquiry.firstName},</p>
                <p>Nous avons bien étudié la candidature de <strong>${inquiry.farmName}</strong> et nous vous remercions de l'intérêt que vous portez à notre AMAP.</p>
                <p>Après examen, nous ne sommes malheureusement pas en mesure de donner suite à votre candidature pour le moment.</p>
                <p>Pour toute question, n'hésitez pas à nous contacter à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                <p>Cordialement,<br>L'équipe Aux P'tits Pois</p>
              </div>
              <div class="footer">
                <p><strong>Aux P'tits Pois - AMAP Solidaire</strong><br>14, rue du Château, 45300 Yèvre-la-Ville</p>
                <p>Cet email a été envoyé à ${inquiry.email} suite à votre candidature.</p>
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
        return `<li style="margin-bottom: 8px;">🥦 ${name}</li>`;
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
                        <p>Bonjour ${recipient.firstName},</p>
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
                        <p>Cet email a été envoyé à ${recipient.email} car vous avez un abonnement actif.<br>
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
                <p>Bonjour ${user.firstName},</p>
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
                <p>Cet email a été envoyé à ${user.email}.<br>
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