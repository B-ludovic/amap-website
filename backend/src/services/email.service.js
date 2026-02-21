import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || 'Aux P\'tits Pois <noreply@auxptitspois.fr>';

class EmailService {

  /* Envoie un email de bienvenue après inscription */

  async sendWelcomeEmail(user) {
    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Bienvenue chez Aux P\'tits Pois 🌱',
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
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🌱 Bienvenue chez Aux P'tits Pois !</h1>
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
                    <a href="${process.env.FRONTEND_URL}/nos-abonnements" class="button">
                      Découvrir nos abonnements
                    </a>
                  </div>
                  
                  <p>Si vous avez des questions, n'hésitez pas à nous contacter à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                  
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p>Aux P'tits Pois - AMAP Solidaire<br>
                  Distribution : Mercredi 18h15-19h15</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Erreur envoi email bienvenue:', error);
        return { success: false, error };
      }

      console.log('✅ Email bienvenue envoyé à', user.email);
      return { success: true, data };
    } catch (error) {
      console.error('Erreur envoi email bienvenue:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de vérification d'adresse email */

  async sendEmailVerification(user, verifyToken) {
    try {
      const verifyUrl = `${process.env.FRONTEND_URL}/auth/confirm-email/${verifyToken}`;

      const { data, error } = await resend.emails.send({
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
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🌱 Confirmez votre email</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${user.firstName},</p>
                  <p>Merci de vous être inscrit sur Aux P'tits Pois. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email :</p>
                  <div style="text-align: center;">
                    <a href="${verifyUrl}" class="button">Confirmer mon email</a>
                  </div>
                  <div class="warning">
                    <strong>Attention :</strong> Ce lien est valable pendant 24 heures.
                  </div>
                  <p>Si vous n'avez pas créé de compte, ignorez simplement cet email.</p>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
                    <a href="${verifyUrl}" style="color: #3b82f6; word-break: break-all;">${verifyUrl}</a>
                  </p>
                  <p>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p>Aux P'tits Pois - AMAP Solidaire</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Erreur envoi email vérification:', error);
        return { success: false, error };
      }

      console.log('✅ Email vérification envoyé à', user.email);
      return { success: true, data };
    } catch (error) {
      console.error('Erreur envoi email vérification:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de récupération de mot de passe */


  async sendPasswordResetEmail(user, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${resetToken}`;

      const { data, error } = await resend.emails.send({
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
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 8px;"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>Réinitialisation de mot de passe</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${user.firstName},</p>
                  
                  <p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte Aux P'tits Pois.</p>
                  
                  <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                  
                  <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">
                      Réinitialiser mon mot de passe
                    </a>
                  </div>
                  
                  <div class="warning">
                    <strong><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Attention :</strong> Ce lien est valable pendant 1 heure seulement.
                  </div>
                  
                  <p>Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email. Votre mot de passe actuel reste inchangé.</p>
                  
                  <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                    <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
                  </p>
                  
                  <p>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p>Aux P'tits Pois - AMAP Solidaire</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Erreur envoi email reset password:', error);
        return { success: false, error };
      }

      console.log('✅ Email reset password envoyé à', user.email);
      return { success: true, data };
    } catch (error) {
      console.error('Erreur envoi email reset password:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de confirmation de demande d'abonnement */

  async sendSubscriptionRequestConfirmation(request) {
    try {
      const { data, error } = await resend.emails.send({
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
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>Demande d'abonnement reçue !</h1>
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
                    <li>Vous effectuez le paiement (chèque, virement ou espèces)</li>
                    <li>Votre abonnement est activé</li>
                    <li>Vous recevez votre premier panier le mercredi suivant !</li>
                  </ol>
                  
                  <p>Si vous avez des questions, n'hésitez pas à nous contacter à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                  
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p>Aux P'tits Pois - AMAP Solidaire<br>
                  Distribution : Mercredi 18h15-19h15</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Erreur envoi email confirmation demande:', error);
        return { success: false, error };
      }

      console.log('✅ Email confirmation demande envoyé à', request.email);
      return { success: true, data };
    } catch (error) {
      console.error('Erreur envoi email confirmation demande:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de confirmation de demande producteur */

  async sendProducerInquiryConfirmation(inquiry) {
    try {
      const { data, error } = await resend.emails.send({
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
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/></svg>Candidature reçue !</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${inquiry.firstName},</p>
                  
                  <p>Merci pour votre intérêt à rejoindre le réseau de producteurs d'Aux P'tits Pois.</p>
                  
                  <p>Nous avons bien reçu votre candidature pour <strong>${inquiry.farmName}</strong> et nous vous recontacterons très prochainement pour échanger sur votre projet.</p>
                  
                  <h3>Prochaines étapes :</h3>
                  <ol>
                    <li>Nous étudions votre candidature (sous 48h)</li>
                    <li>Échange téléphonique pour mieux vous connaître</li>
                    <li>Visite de votre exploitation si possible</li>
                    <li>Validation et intégration au réseau</li>
                    <li>Première livraison !</li>
                  </ol>
                  
                  <p>Si vous avez des questions, n'hésitez pas à nous contacter à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                  
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p>Aux P'tits Pois - AMAP Solidaire</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Erreur envoi email confirmation producteur:', error);
        return { success: false, error };
      }

      console.log('✅ Email confirmation producteur envoyé à', inquiry.email);
      return { success: true, data };
    } catch (error) {
      console.error('Erreur envoi email confirmation producteur:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un message de contact à l'adresse de l'AMAP */

  async sendContactMessage({ name, email, subject, message }) {
    try {
      const { data, error } = await resend.emails.send({
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
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Nouveau message de contact</h1>
                </div>
                <div class="content">
                  <div class="info-box">
                    <p><strong>Nom :</strong> ${name}</p>
                    <p><strong>Email :</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Sujet :</strong> ${subject}</p>
                  </div>
                  <p><strong>Message :</strong></p>
                  <div class="message-box">${message}</div>
                  <p style="color: #6b7280; font-size: 14px;">
                    Répondez directement à cet email pour contacter ${name}.
                  </p>
                </div>
                <div class="footer">
                  <p>Aux P'tits Pois - Formulaire de contact</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Erreur envoi email contact:', error);
        return { success: false, error };
      }

      console.log('✅ Email contact envoyé depuis', email);
      return { success: true, data };
    } catch (error) {
      console.error('Erreur envoi email contact:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie une newsletter */

  async sendNewsletter(newsletter, recipients) {
    try {
      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      // Envoi en batch (max 50 emails à la fois avec Resend)
      const batchSize = 50;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        for (const recipient of batch) {
          try {
            const { data, error } = await resend.emails.send({
              from: EMAIL_FROM,
              to: recipient.email,
              subject: newsletter.subject,
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #6b9d5a 0%, #5a8a4a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                      .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
                      .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1>🌱 Aux P'tits Pois</h1>
                      </div>
                      <div class="content">
                        ${newsletter.content}
                      </div>
                      <div class="footer">
                        <p>Aux P'tits Pois - AMAP Solidaire<br>
                        Distribution : Mercredi 18h15-19h15</p>
                        <p style="font-size: 12px; margin-top: 20px;">
                          Vous recevez cet email car vous êtes abonné à Aux P'tits Pois.
                        </p>
                      </div>
                    </div>
                  </body>
                </html>
              `,
            });

            if (error) {
              results.failed++;
              results.errors.push({ email: recipient.email, error });
            } else {
              results.sent++;
            }
          } catch (emailError) {
            results.failed++;
            results.errors.push({ email: recipient.email, error: emailError.message });
          }
        }

        // Pause entre les batches pour éviter rate limiting
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Newsletter envoyée : ${results.sent} succès, ${results.failed} échecs`);
      return { success: true, results };
    } catch (error) {
      console.error('Erreur envoi newsletter:', error);
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de confirmation d'abonnement créé */

  async sendSubscriptionConfirmation(subscription, user) {
    try {
      const { data, error } = await resend.emails.send({
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
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/></svg>Bienvenue dans l'aventure !</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${user.firstName},</p>
                  
                  <p>Félicitations ! Votre abonnement Aux P'tits Pois est maintenant <strong>activé</strong>.</p>
                  
                  <div class="info-box">
                    <h3 style="margin-top: 0;">Votre abonnement :</h3>
                    <p><strong>N° :</strong> ${subscription.subscriptionNumber}</p>
                    <p><strong>Type :</strong> ${subscription.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte'}</p>
                    <p><strong>Panier :</strong> ${subscription.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}</p>
                    <p><strong>Début :</strong> ${new Date(subscription.startDate).toLocaleDateString('fr-FR')}</p>
                  </div>
                  
                  <div class="highlight">
                    <h3 style="margin-top: 0;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b9d5a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Retrait de votre panier</h3>
                    <p style="margin: 0;"><strong>Chaque mercredi de 18h15 à 19h15</strong><br>
                    ${subscription.pickupLocation.name}<br>
                    ${subscription.pickupLocation.address}<br>
                    ${subscription.pickupLocation.postalCode} ${subscription.pickupLocation.city}</p>
                  </div>
                  
                  <h3>Comment ça marche ?</h3>
                  <ol>
                    <li>Chaque semaine, nous publions la composition du panier</li>
                    <li>Vous composez votre panier selon votre formule</li>
                    <li>Vous venez le récupérer le mercredi</li>
                  </ol>
                  
                  <p>Rendez-vous dès mercredi prochain pour votre premier panier !</p>
                  
                  <p>Si vous avez des questions, contactez-nous à <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>.</p>
                  
                  <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>
                </div>
                <div class="footer">
                  <p>Aux P'tits Pois - AMAP Solidaire</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Erreur envoi email confirmation abonnement:', error);
        return { success: false, error };
      }

      console.log('✅ Email confirmation abonnement envoyé à', user.email);
      return { success: true, data };
    } catch (error) {
      console.error('Erreur envoi email confirmation abonnement:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();