import nodemailer from 'nodemailer';

// Créer le transporteur email (la configuration pour envoyer des emails)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true pour le port 465, false pour les autres ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// FONCTION GÉNÉRIQUE POUR ENVOYER UN EMAIL 
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `Aux P'tits Pois <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text // Version texte brut (fallback si le HTML ne s'affiche pas)
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email envoyé:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    throw error;
  }
};

// EMAIL DE BIENVENUE 
const sendWelcomeEmail = async (user, confirmationToken) => {
  const confirmationUrl = `${process.env.FRONTEND_URL}/auth/confirm/${confirmationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #a7f3d0 0%, #fcd34d 100%); color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; background: #fef3f9; }
        .button { 
          display: inline-block; 
          padding: 14px 28px; 
          background: #fb923c; 
          color: white; 
          text-decoration: none; 
          border-radius: 8px; 
          margin: 20px 0;
          font-weight: bold;
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #fff; border-radius: 0 0 10px 10px; }
        .icon { width: 60px; height: 60px; margin-bottom: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.FRONTEND_URL}/icons/hello.png" alt="Bienvenue" class="icon" />
          <h1>Bienvenue chez Aux P'tits Pois !</h1>
        </div>
        <div class="content">
          <h2>Bonjour ${user.firstName} !</h2>
          <p>Nous sommes ravis de vous accueillir dans notre communauté.</p>
          <p>Pour commencer à commander vos paniers de légumes locaux, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
          <div style="text-align: center;">
            <a href="${confirmationUrl}" class="button">Confirmer mon email</a>
          </div>
          <p>Ou copiez ce lien dans votre navigateur :</p>
          <p style="font-size: 12px; color: #666;">${confirmationUrl}</p>
          <p>À bientôt,<br>L'équipe Aux P'tits Pois <img src="${process.env.FRONTEND_URL}/icons/trees.png" alt="" style="width: 20px; vertical-align: middle;" /></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Aux P'tits Pois - Tous droits réservés</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Bienvenue chez Aux P'tits Pois !
    
    Bonjour ${user.firstName},
    
    Pour confirmer votre email, cliquez sur ce lien : ${confirmationUrl}
    
    À bientôt,
    L'équipe Aux P'tits Pois
  `;

  return sendEmail({
    to: user.email,
    subject: "Bienvenue chez Aux P'tits Pois 🌱",
    html,
    text
  });
};

// EMAIL DE CONFIRMATION D'EMAIL 
const sendEmailConfirmation = async (user, confirmationToken) => {
  const confirmationUrl = `${process.env.FRONTEND_URL}/auth/confirm/${confirmationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #fef3f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.FRONTEND_URL}/icons/sent-mail.png" alt="Email" style="width: 60px; height: 60px;" />
        </div>
        <h2 style="color: #a7f3d0;">Confirmez votre adresse email</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>Cliquez sur le lien ci-dessous pour confirmer votre adresse email :</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmationUrl}" 
             style="display: inline-block; padding: 14px 28px; background: #fb923c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Confirmer mon email
          </a>
        </div>
        <p>Ce lien expire dans 24 heures.</p>
        <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Confirmez votre adresse email
    
    Bonjour ${user.firstName},
    
    Cliquez sur ce lien pour confirmer votre email : ${confirmationUrl}
    
    Ce lien expire dans 24 heures.
  `;

  return sendEmail({
    to: user.email,
    subject: "Confirmez votre email - Aux P'tits Pois",
    html,
    text
  });
};

// EMAIL DE RÉINITIALISATION DE MOT DE PASSE 
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #fef3f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.FRONTEND_URL}/icons/padlock.png" alt="Sécurité" style="width: 60px; height: 60px;" />
        </div>
        <h2 style="color: #a7f3d0;">Réinitialisation de mot de passe</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 14px 28px; background: #fb923c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p>Ce lien expire dans 1 heure.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Réinitialisation de mot de passe
    
    Bonjour ${user.firstName},
    
    Cliquez sur ce lien pour réinitialiser votre mot de passe : ${resetUrl}
    
    Ce lien expire dans 1 heure.
  `;

  return sendEmail({
    to: user.email,
    subject: "Réinitialisation de mot de passe - Aux P'tits Pois",
    html,
    text
  });
};

// EMAIL DE CONFIRMATION DE COMMANDE 
const sendOrderConfirmationEmail = async (order, user) => {
  const orderUrl = `${process.env.FRONTEND_URL}/compte/commandes/${order.id}`;

  // Calculer le nombre total de paniers
  const totalBaskets = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Liste des paniers
  const basketsList = order.orderItems.map(item => `
    <li>
      ${item.quantity} x ${item.basketAvailability.basketType.name} 
      (${item.priceAtOrder}€ l'unité)
    </li>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #fef3f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.FRONTEND_URL}/icons/validation.png" alt="Confirmé" style="width: 60px; height: 60px;" />
        </div>
        <h2 style="color: #a7f3d0; text-align: center;">Commande confirmée !</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>Votre commande <strong>#${order.orderNumber}</strong> a bien été enregistrée.</p>
        
        <div style="background: #fef3f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #fb923c;">
          <h3 style="color: #fb923c; margin-top: 0;">Récapitulatif</h3>
          <ul style="list-style: none; padding: 0;">
            ${basketsList}
          </ul>
          <hr style="border: none; border-top: 1px solid #fcd34d; margin: 15px 0;">
          <p style="font-size: 1.1em; color: #fb923c;"><strong>Total : ${order.totalAmount}€</strong></p>
          <p><strong>Retrait :</strong> ${order.pickupLocation.name}</p>
          <p><strong>Date de retrait :</strong> ${new Date(order.pickupDate).toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })}</p>
        </div>
        
        <p>Vous recevrez un email lorsque votre commande sera prête.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}" 
             style="display: inline-block; padding: 14px 28px; background: #fb923c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Voir ma commande
          </a>
        </div>
        
        <p style="text-align: center; color: #666;">Merci de votre confiance !<br>L'équipe Aux P'tits Pois <img src="${process.env.FRONTEND_URL}/icons/trees.png" alt="" style="width: 20px; vertical-align: middle;" /></p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Commande confirmée !
    
    Bonjour ${user.firstName},
    
    Votre commande #${order.orderNumber} a bien été enregistrée.
    
    Total : ${order.totalAmount}€
    Retrait : ${order.pickupLocation.name}
    Date : ${new Date(order.pickupDate).toLocaleDateString('fr-FR')}
    
    Merci !
    L'équipe Aux P'tits Pois
  `;

  return sendEmail({
    to: user.email,
    subject: `Commande confirmée #${order.orderNumber} - Aux P'tits Pois`,
    html,
    text
  });
};

// EMAIL DE CONFIRMATION DE PAIEMENT 
const sendPaymentConfirmationEmail = async (order, user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #fef3f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.FRONTEND_URL}/icons/payment.png" alt="Paiement" style="width: 60px; height: 60px;" />
        </div>
        <h2 style="color: #a7f3d0; text-align: center;">Paiement confirmé !</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>Nous avons bien reçu votre paiement de <strong style="color: #fb923c;">${order.totalAmount}€</strong> pour la commande <strong>#${order.orderNumber}</strong>.</p>
        <div style="background: #fef3f9; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #fcd34d;">
          <p style="margin: 5px 0;">Votre commande est maintenant en préparation.</p>
          <p style="margin: 5px 0;">Vous recevrez un email lorsqu'elle sera prête pour le retrait.</p>
        </div>
        <p style="text-align: center; color: #666;">Merci !<br>L'équipe Aux P'tits Pois <img src="${process.env.FRONTEND_URL}/icons/trees.png" alt="" style="width: 20px; vertical-align: middle;" /></p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Paiement confirmé !
    
    Bonjour ${user.firstName},
    
    Nous avons bien reçu votre paiement de ${order.totalAmount}€.
    Commande #${order.orderNumber}
    
    Merci !
  `;

  return sendEmail({
    to: user.email,
    subject: `Paiement confirmé #${order.orderNumber} - Aux P'tits Pois`,
    html,
    text
  });
};

// EMAIL COMMANDE PRÊTE 
const sendOrderReadyEmail = async (order, user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #fef3f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.FRONTEND_URL}/icons/delivery-box.png" alt="Livraison" style="width: 60px; height: 60px;" />
        </div>
        <h2 style="color: #a7f3d0; text-align: center;">Votre commande est prête !</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>Bonne nouvelle ! Votre commande <strong>#${order.orderNumber}</strong> est prête à être récupérée.</p>
        
        <div style="background: #fef3f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #fb923c;">
          <h3 style="color: #fb923c; margin-top: 0;">Informations de retrait</h3>
          <p><strong>Lieu :</strong> ${order.pickupLocation.name}</p>
          <p><strong>Adresse :</strong> ${order.pickupLocation.address}, ${order.pickupLocation.postalCode} ${order.pickupLocation.city}</p>
          <p><strong>Date :</strong> ${new Date(order.pickupDate).toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })}</p>
        </div>
        
        <p>N'oubliez pas d'apporter votre numéro de commande : <strong style="color: #fb923c;">#${order.orderNumber}</strong></p>
        <p style="text-align: center; color: #666;">À très bientôt !<br>L'équipe Aux P'tits Pois <img src="${process.env.FRONTEND_URL}/icons/trees.png" alt="" style="width: 20px; vertical-align: middle;" /></p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Votre commande est prête !
    
    Bonjour ${user.firstName},
    
    Votre commande #${order.orderNumber} est prête.
    
    Retrait : ${order.pickupLocation.name}
    ${order.pickupLocation.address}
    ${order.pickupLocation.postalCode} ${order.pickupLocation.city}
    
    Date : ${new Date(order.pickupDate).toLocaleDateString('fr-FR')}
    
    À bientôt !
  `;

  return sendEmail({
    to: user.email,
    subject: `Votre commande est prête ! #${order.orderNumber}`,
    html,
    text
  });
};

// EMAIL RAPPEL DE RETRAIT 
const sendOrderReminderEmail = async (order, user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #fef3f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.FRONTEND_URL}/icons/sand-timer.png" alt="Rappel" style="width: 60px; height: 60px;" />
        </div>
        <h2 style="color: #fcd34d; text-align: center;">Rappel : Retrait demain !</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>Petit rappel : votre commande <strong>#${order.orderNumber}</strong> est à récupérer demain.</p>
        
        <div style="background: #fef3f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #fb923c;">
          <p><strong>Lieu :</strong> ${order.pickupLocation.name}</p>
          <p><strong>Adresse :</strong> ${order.pickupLocation.address}, ${order.pickupLocation.city}</p>
          <p><strong>Demain :</strong> ${new Date(order.pickupDate).toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}</p>
        </div>
        
        <p style="text-align: center; color: #666;">À demain !<br>L'équipe Aux P'tits Pois <img src="${process.env.FRONTEND_URL}/icons/trees.png" alt="" style="width: 20px; vertical-align: middle;" /></p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Rappel : Retrait demain !
    
    Bonjour ${user.firstName},
    
    Votre commande #${order.orderNumber} est à récupérer demain.
    
    Lieu : ${order.pickupLocation.name}
    ${order.pickupLocation.address}
    
    À demain !
  `;

  return sendEmail({
    to: user.email,
    subject: `Rappel : Retrait demain - Commande #${order.orderNumber}`,
    html,
    text
  });
};

// EMAIL D'ANNULATION DE COMMANDE 
const sendOrderCancelledEmail = async (order, user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #fef3f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.FRONTEND_URL}/icons/annuler.png" alt="Annulé" style="width: 60px; height: 60px;" />
        </div>
        <h2 style="color: #fb923c; text-align: center;">Commande annulée</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>Votre commande <strong>#${order.orderNumber}</strong> a été annulée.</p>
        <div style="background: #fef3f9; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #fcd34d;">
          <p style="margin: 5px 0;">Si vous avez déjà payé, vous serez remboursé sous 3 à 5 jours ouvrés.</p>
          <p style="margin: 5px 0;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
        </div>
        <p style="text-align: center; color: #666;">À bientôt,<br>L'équipe Aux P'tits Pois <img src="${process.env.FRONTEND_URL}/icons/trees.png" alt="" style="width: 20px; vertical-align: middle;" /></p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Commande annulée
    
    Bonjour ${user.firstName},
    
    Votre commande #${order.orderNumber} a été annulée.
    
    Si vous avez payé, vous serez remboursé sous 3 à 5 jours.
    
    À bientôt !
  `;

  return sendEmail({
    to: user.email,
    subject: `Commande annulée #${order.orderNumber}`,
    html,
    text
  });
};

export default sendEmail;

export {
  sendWelcomeEmail,
  sendEmailConfirmation,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendPaymentConfirmationEmail,
  sendOrderReadyEmail,
  sendOrderReminderEmail,
  sendOrderCancelledEmail
};