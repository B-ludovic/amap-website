import nodemailer from 'nodemailer';
import DOMPurify from 'isomorphic-dompurify';
import { prisma } from '../config/database.js';
import { euroAmount, splitPayment, formatInstallments } from '../utils/subscriptionPricing.js';
import { overridesOptOut } from './newsletterAudience.service.js';
import { unsubscribePageUrl, unsubscribeHeaders } from '../utils/unsubscribeToken.js';
import { estSupprimee } from './emailSuppression.service.js';
import { renderEmail, emailButton, emailToText } from './emailTheme.js';

/* Pool : sans lui chaque message rouvrait une connexion TCP + TLS + auth.
   Délais de garde : le défaut de nodemailer est de dix minutes sur un socket
   muet, de quoi immobiliser la boucle d'envoi. Valeurs calibrées pour Brevo
   depuis l'Europe — un relais plus lent demanderait de les relever. */
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },

  pool: true,
  maxConnections: 3,
  maxMessages: 100,

  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

/* Une clé révoquée se découvrait au premier envoi raté. Avertissement et non
   arrêt : une coupure chez Brevo ne doit pas empêcher de consulter le site. */
if (process.env.NODE_ENV === 'production') {
  transporter.verify()
    .then(() => console.log('[Email] relais Brevo joignable'))
    .catch((error) => console.error(`[Email] relais Brevo INJOIGNABLE : ${error.message}`));
}

// Les sockets du pool retiendraient le processus au redéploiement.
export function closeEmailTransport() {
  transporter.close();
}

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

/* Fuseau nommé plutôt qu'hérité : l'hébergeur tourne en UTC, où 23 h 30 à Paris
   est encore la veille — dans un message qui sert à reconnaître son propre
   geste, l'heure doit être celle de l'horloge du destinataire. */
const dateEtHeure = (value) => new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  dateStyle: 'long',
  timeStyle: 'short',
}).format(new Date(value));

// Recopiée dans six messages avant d'être rassemblée ici.
const AMAP_EMAIL = 'auxptitspois@gmail.com';

// Les mêmes mots que l'espace adhérent et l'écran des utilisateurs.
const ROLE_LABELS = { MEMBER: 'Adhérent', VOLUNTEER: 'Bénévole', ADMIN: 'Administrateur' };

/* Deux portes pour deux publics : l'adhérent a un espace, le candidat
   producteur n'a pas de compte — l'y envoyer serait une porte fermée. */
const droitsViaEspace = () =>
  `Pour consulter, modifier ou supprimer vos données, <a href="${escapeHtml(`${process.env.FRONTEND_URL}/compte`)}">ouvrez votre espace adhérent</a>.`;

const droitsViaEmail = () =>
  `Pour consulter, modifier ou supprimer vos données, écrivez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.`;

const rgpdNote = (email, raison) =>
  `Cet email a été envoyé à ${escapeHtml(email)} ${raison}.<br>${droitsViaEspace()}`;

const rgpdNoteSansCompte = (email, raison) =>
  `Cet email a été envoyé à ${escapeHtml(email)} ${raison}.<br>${droitsViaEmail()}`;

class EmailService {

  /* La liste des adresses mortes, consultée juste avant d'écrire.

     Ce filet attrape les messages unitaires — bienvenue, réinitialisation — que
     les listes filtrées en amont ne voient pas. Une erreur de lecture laisse
     passer le message : une base indisponible ne doit pas couper le courrier,
     elle rendrait muette une application par ailleurs saine. */
  async #adresseSupprimee(email) {
    try {
      return await estSupprimee(email);
    } catch (error) {
      console.error(`[Email] liste des adresses supprimées illisible : ${error.message}`);
      return null;
    }
  }

  /* Point de passage unique de tout message sortant : une ligne de log pour
     l'équipe, une ligne en base pour répondre à « untel a-t-il reçu son
     message le 12 mars ? », qu'aucun log rotatif ne sait tenir. */
  async #send(mailOptions, { kind, ref = null }) {
    const supprimee = await this.#adresseSupprimee(mailOptions.to);

    if (supprimee) {
      const motif = `adresse écartée (${supprimee.reason})`;
      console.warn(`[Email:${kind}] non envoyé : ${motif}`);
      await this.#trace({ kind, ref, mailOptions, status: 'FAILED', error: motif });

      return { success: false, error: motif };
    }

    try {
      // Ajoutée ici seulement : seul endroit par lequel les 19 messages passent.
      const message = mailOptions.html && !mailOptions.text
        ? { ...mailOptions, text: emailToText(mailOptions.html) }
        : mailOptions;

      const info = await transporter.sendMail(message);
      await this.#trace({ kind, ref, mailOptions, status: 'SENT', messageId: info?.messageId ?? null });

      if (process.env.NODE_ENV !== 'production') console.log(`[Email:${kind}] envoyé à ${mailOptions.to}`);

      return { success: true };
    } catch (error) {
      /* Donnée personnelle hors des logs de production (règle d'error.middleware.js).
         Elle est en base, dans EmailLog, qui est purgé. */
      const destinataire = process.env.NODE_ENV === 'production' ? '[adresse en base]' : mailOptions.to;
      console.error(`[Email:${kind}] échec d'envoi vers ${destinataire} : ${error.message}`);

      await this.#trace({ kind, ref, mailOptions, status: 'FAILED', error: error.message });

      return { success: false, error: error.message };
    }
  }

  /* Ne doit jamais faire tomber l'envoi qu'elle décrit : une base injoignable
     transformerait un message parti en erreur 500, voire en rejet non capturé
     sur l'appel non attendu des paniers. Seule l'enveloppe est gardée — le HTML
     porte le prénom et l'adresse de retrait. */
  async #trace({ kind, ref, mailOptions, status, messageId = null, error = null }) {
    try {
      await prisma.emailLog.create({
        data: {
          kind,
          ref: ref ?? null,
          to: String(mailOptions.to),
          subject: String(mailOptions.subject ?? ''),
          status,
          messageId,
          error,
        },
      });
    } catch (traceError) {
      console.error(`[Email:${kind}] trace non enregistrée : ${traceError.message}`);
    }
  }

  /* Envoie un email de bienvenue après inscription */
  async sendWelcomeEmail(user) {
    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Bienvenue chez Aux P\'tits Pois',
      html: renderEmail({
        title: 'Bienvenue chez Aux P\'tits Pois',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Merci d'avoir créé votre compte sur Aux P'tits Pois, votre AMAP locale pour des produits frais, bio et de saison.</p>
            <p>Votre compte est maintenant actif et vous pouvez :</p>
            <ul>
              <li>Consulter le panier de la semaine</li>
              <li>Faire une demande d'abonnement</li>
              <li>Découvrir nos producteurs locaux</li>
            </ul>
            ${emailButton(`${process.env.FRONTEND_URL}/nos-abonnements`, 'Découvrir nos abonnements')}
            <p>Si vous avez des questions, n'hésitez pas à nous écrire à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.</p>
            <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'car vous êtes inscrit(e) sur notre plateforme'),
      }),
    }, { kind: 'WELCOME', ref: user.id });
  }

  /* Envoie un email de vérification d'adresse email */
  async sendEmailVerification(user, verifyToken) {
    const verifyUrl = `${process.env.FRONTEND_URL}/auth/confirm-email/${verifyToken}`;

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Confirmez votre adresse email - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Confirmez votre email',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Merci de vous être inscrit sur Aux P'tits Pois. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email :</p>
            ${emailButton(verifyUrl, 'Confirmer mon email')}
            <div class="warning"><strong>Ce lien est valable 24 heures.</strong> Passé ce délai, il faudra en demander un nouveau depuis la page de connexion.</div>
            <p>Si vous n'avez pas créé de compte, ignorez simplement cet email.</p>
            <p style="font-size:13px;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
              <a href="${verifyUrl}" style="word-break:break-all;">${verifyUrl}</a>
            </p>
            <p>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'dans le cadre de votre inscription'),
      }),
    }, { kind: 'EMAIL_VERIFICATION', ref: user.id });
  }

  /* Prévient qu'une inscription a été tentée sur une adresse déjà enregistrée.
     Remplace le 409 « cet email existe déjà », qui permettait à un tiers de
     vérifier l'appartenance d'une personne à l'AMAP. Les données affichées
     viennent exclusivement de la base, jamais du formulaire d'inscription :
     sinon n'importe qui pourrait faire arriver le texte de son choix dans la
     boîte mail de l'adhérent. */
  async sendAccountAlreadyExists(user) {
    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Tentative de création de compte - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Vous avez déjà un compte',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Quelqu'un vient de tenter de créer un compte sur Aux P'tits Pois avec votre adresse email. Un compte existe déjà à cette adresse : aucun nouveau compte n'a été créé et votre mot de passe n'a pas été modifié.</p>
            <p><strong>Si c'était vous</strong>, connectez-vous simplement avec votre mot de passe habituel :</p>
            ${emailButton(`${process.env.FRONTEND_URL}/auth/login`, 'Me connecter')}
            <p>Vous l'avez oublié ? <a href="${process.env.FRONTEND_URL}/auth/forgot-password">Réinitialisez-le en deux minutes</a>.</p>
            <div class="warning"><strong>Si ce n'était pas vous :</strong> il n'y a rien à faire, votre compte n'a pas été touché. Si ces messages se répètent, écrivez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.</div>
            <p>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'car un compte existe à cette adresse'),
      }),
    }, { kind: 'ACCOUNT_ALREADY_EXISTS', ref: user.id });
  }

  /* Envoie un email de récupération de mot de passe */
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe',
      html: renderEmail({
        title: 'Réinitialisation de mot de passe',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte Aux P'tits Pois.</p>
            <p>Cliquez sur le bouton ci-dessous pour en créer un nouveau :</p>
            ${emailButton(resetUrl, 'Réinitialiser mon mot de passe')}
            <div class="warning"><strong>Ce lien est valable une heure.</strong> Au-delà, il faudra refaire une demande depuis la page de connexion.</div>
            <p>Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email : votre mot de passe reste inchangé.</p>
            <p>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'suite à une demande de réinitialisation faite sur notre site'),
      }),
    }, { kind: 'PASSWORD_RESET', ref: user.id });
  }

  /* Le seul message qui permette à un adhérent de découvrir qu'on lui a pris son
     compte. Il conseille de sécuriser la messagerie avant de reprendre la main
     ici : le lien de réinitialisation y est arrivé, reprendre le mot de passe
     sans fermer cette porte ne ferait que rejouer la scène. */
  async sendPasswordChanged(user, changeLe = new Date()) {
    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre mot de passe a été modifié - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Votre mot de passe a été modifié',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Le mot de passe de votre compte Aux P'tits Pois a été modifié le ${dateEtHeure(changeLe)}.</p>
            <p>Vos appareils déjà connectés ont été déconnectés : il faut désormais vous reconnecter avec le nouveau mot de passe.</p>
            <p><strong>Si c'était vous</strong>, il n'y a rien d'autre à faire.</p>
            <div class="warning"><strong>Si ce n'était pas vous :</strong> le lien de réinitialisation est arrivé dans cette boîte email, quelqu'un d'autre y a donc accès. Changez d'abord le mot de passe de votre messagerie, puis <a href="${process.env.FRONTEND_URL}/auth/forgot-password">reprenez la main sur votre compte</a>, et prévenez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.</div>
            <p>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'car le mot de passe de votre compte vient d\'être modifié'),
      }),
    }, { kind: 'PASSWORD_CHANGED', ref: user.id });
  }

  /* Accusé d'effacement. Le compte est fermé sur-le-champ, les données partent
     à échéance : dire les deux temps évite qu'un adhérent croie ses données
     déjà détruites, ou au contraire conservées sans terme. C'est aussi la seule
     fenêtre pendant laquelle une suppression accidentelle peut être défaite. */
  async sendAccountDeleted(user, { effaceLe }) {
    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre compte a été supprimé - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Votre compte a été supprimé',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Votre compte Aux P'tits Pois est fermé : la connexion n'est plus possible et vous ne recevrez plus aucun message de notre part.</p>
            <div class="info-box">
              <h3>Ce que deviennent vos données</h3>
              <p>Vos contrats, règlements, retraits de panier et demandes d'abonnement seront <strong>effacés définitivement le ${longDate(effaceLe)}</strong>.</p>
              <p>Les recettes et lettres d'information que vous avez rédigées pour l'association restent en ligne : elles appartiennent à l'AMAP, et ne portent plus votre nom.</p>
            </div>
            <div class="warning">Cette suppression n'est pas ce que vous vouliez ? Écrivez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a> avant cette date : passé ce délai, plus rien ne pourra être rétabli.</div>
            <p>Merci pour le temps passé avec nous,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNoteSansCompte(user.email, 'pour accuser réception de la suppression de votre compte'),
      }),
    }, { kind: 'ACCOUNT_DELETED', ref: user.id });
  }

  /* Trois rôles, mais une seule porte : seul ADMIN ouvre l'administration.
     Le message annonce donc ce qui change vraiment — un accès qui s'ouvre, un
     accès qui se ferme, ou un libellé — sans promettre à un bénévole des droits
     qu'aucun contrôle ne lui donne. */
  async sendRoleChanged(user, { role, ancienRole }) {
    const gagneLAdministration = role === 'ADMIN';
    const perdLAdministration = ancienRole === 'ADMIN' && role !== 'ADMIN';
    const libelle = ROLE_LABELS[role] ?? role;

    const corps = gagneLAdministration
      ? `<p>Vous avez désormais accès à <strong>l'espace d'administration</strong> d'Aux P'tits Pois. Vous y trouverez les adhérents, les contrats, les paniers et les permanences.</p>
         <div class="warning">Vous y voyez les coordonnées, les contrats et les règlements des autres adhérents. Ces données ne quittent pas l'association et ne servent qu'à la faire tourner.</div>
         ${emailButton(`${process.env.FRONTEND_URL}/admin`, 'Ouvrir l\'administration')}`
      : perdLAdministration
        ? `<p>Votre accès à l'espace d'administration a été retiré ; votre profil est désormais « ${libelle} ».</p>
           <p>Votre compte reste ouvert et votre abonnement n'est pas touché.</p>`
        : `<p>Votre profil est désormais « ${libelle} » dans l'espace adhérent.</p>`;

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre rôle a changé - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Votre rôle a changé',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            ${corps}
            <p>Une question ? Écrivez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.</p>
            <p>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'car votre rôle vient d\'être modifié par l\'association'),
      }),
    }, { kind: 'ROLE_CHANGED', ref: user.id });
  }

  /* Envoie un email de confirmation de demande d'abonnement */
  async sendSubscriptionRequestConfirmation(request) {
    return this.#send({
      from: EMAIL_FROM,
      to: request.email,
      subject: 'Demande d\'abonnement reçue - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Demande d\'abonnement reçue',
        content: `
            <p>Bonjour ${escapeHtml(request.firstName)},</p>
            <p>Nous avons bien reçu votre demande d'abonnement à Aux P'tits Pois.</p>
            <div class="info-box">
              <h3>Récapitulatif de votre demande</h3>
              <p><strong>Type :</strong> ${request.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte (3 mois)'}</p>
              <p><strong>Panier :</strong> ${request.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}</p>
              <p><strong>Tarification :</strong> ${request.pricingType === 'NORMAL' ? 'Tarif normal' : 'Tarif solidaire'}</p>
            </div>
            <h3>Prochaines étapes</h3>
            <ol>
              <li>Nous étudions votre demande, sous 48 heures</li>
              <li>Nous vous contactons pour valider les informations</li>
              <li>Vous effectuez le paiement</li>
              <li>Votre abonnement est activé</li>
            </ol>
            <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        /* userId est optionnel dans le modèle et la purge compte des demandes
           sans compte : la mention suit la donnée plutôt qu'un pari. */
        footerNote: request.userId
          ? rgpdNote(request.email, 'suite à votre demande d\'abonnement')
          : rgpdNoteSansCompte(request.email, 'suite à votre demande d\'abonnement'),
      }),
    }, { kind: 'SUBSCRIPTION_REQUEST_CONFIRMATION', ref: request.id });
  }

  /* Même règle de pied de page que la confirmation, pour la même raison : une
     demande peut venir de quelqu'un qui n'a pas de compte. */
  #piedDeDemande(request, raison) {
    return request.userId
      ? rgpdNote(request.email, raison)
      : rgpdNoteSansCompte(request.email, raison);
  }

  /* Liste d'attente : sans ce message, la demande reste sans réponse aussi
     longtemps qu'une place ne se libère pas — c'est-à-dire parfois une saison
     entière, pendant laquelle le candidat ignore s'il a été oublié. */
  async sendSubscriptionRequestWaitlisted(request) {
    return this.#send({
      from: EMAIL_FROM,
      to: request.email,
      subject: 'Votre demande est en liste d\'attente - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Votre demande est en liste d\'attente',
        content: `
            <p>Bonjour ${escapeHtml(request.firstName)},</p>
            <p>Nous avons étudié votre demande d'abonnement. Nous n'avons pas de panier disponible dans l'immédiat : votre demande est <strong>placée en liste d'attente</strong>.</p>
            <p>Elle reste enregistrée et nous vous recontactons dès qu'une place se libère. Vous n'avez aucune démarche à faire.</p>
            <div class="info-box">
              <h3>Votre demande</h3>
              <p><strong>Type :</strong> ${request.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte (3 mois)'}</p>
              <p><strong>Panier :</strong> ${request.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}</p>
            </div>
            <p>Pour toute question, écrivez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.</p>
            <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: this.#piedDeDemande(request, 'suite à votre demande d\'abonnement'),
      }),
    }, { kind: 'SUBSCRIPTION_REQUEST_WAITLISTED', ref: request.id });
  }

  /* Le pendant du refus de candidature producteur, qui existait déjà : une
     demande refusée sans réponse laisse quelqu'un attendre indéfiniment. Les
     notes de l'administration restent internes, elles ne partent pas d'ici. */
  async sendSubscriptionRequestRejected(request) {
    return this.#send({
      from: EMAIL_FROM,
      to: request.email,
      subject: 'Réponse à votre demande d\'abonnement - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Réponse à votre demande',
        content: `
            <p>Bonjour ${escapeHtml(request.firstName)},</p>
            <p>Nous avons bien étudié votre demande d'abonnement et nous vous remercions de l'intérêt que vous portez à notre AMAP.</p>
            <p>Après examen, nous ne sommes malheureusement pas en mesure d'y donner suite.</p>
            <p>Les places évoluent d'une saison à l'autre : n'hésitez pas à retenter votre chance, ou à nous écrire à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a> si vous souhaitez en parler.</p>
            <p>Cordialement,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: this.#piedDeDemande(request, 'suite à votre demande d\'abonnement'),
      }),
    }, { kind: 'SUBSCRIPTION_REQUEST_REJECTED', ref: request.id });
  }

  /* Envoie un email de confirmation de demande producteur */
  async sendProducerInquiryConfirmation(inquiry) {
    return this.#send({
      from: EMAIL_FROM,
      to: inquiry.email,
      subject: 'Candidature reçue - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Candidature reçue',
        content: `
            <p>Bonjour ${escapeHtml(inquiry.firstName)},</p>
            <p>Nous avons bien reçu votre candidature pour <strong>${escapeHtml(inquiry.farmName)}</strong> et nous vous recontacterons très prochainement.</p>
            <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNoteSansCompte(inquiry.email, 'suite à votre candidature de producteur'),
      }),
    }, { kind: 'PRODUCER_INQUIRY_CONFIRMATION', ref: inquiry.id });
  }

  /* Envoie un message de contact à l'adresse de l'AMAP */
  async sendContactMessage({ name, email, subject, message }) {
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);

    return this.#send({
      from: EMAIL_FROM,
      to: AMAP_EMAIL,
      replyTo: email,
      subject: `[Contact] ${String(subject).replace(/[\r\n]+/g, ' ')}`,
      html: renderEmail({
        title: 'Nouveau message de contact',
        eyebrow: 'Formulaire du site',
        content: `
            <div class="info-box">
              <p><strong>Nom :</strong> ${safeName}</p>
              <p><strong>Email :</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
              <p><strong>Sujet :</strong> ${safeSubject}</p>
            </div>
            <p><strong>Message :</strong></p>
            <div class="message-box">${DOMPurify.sanitize(message, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}</div>`,
        /* Sans mention RGPD à dessein : destinataire interne, la personne
           dont il parle n'est pas celle qui le reçoit. */
        footerNote: 'Message automatique émis par le formulaire de contact du site. Répondre à cet email écrit directement à son auteur.',
      }),
    }, { kind: 'CONTACT_MESSAGE', ref: null });
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

  /* Le bas d'une newsletter, et les en-têtes qui l'accompagnent.

     Ce pied de page n'est pas une formule de politesse : c'est le seul endroit
     où se tient la promesse d'un désabonnement « simple et gratuit » que
     réclament l'article L34-5 du code des postes et l'article 21 du RGPD. Il
     porte donc un lien qui agit vraiment, scellé pour l'adresse à qui l'on
     écrit, et qui n'exige ni compte ouvert ni mot de passe retrouvé.

     Deux versions, selon ce qu'on envoie. Une lettre d'information annonce
     qu'on peut la couper. Une alerte — fermeture, distribution annulée —
     annonce l'inverse, puisqu'elle continuera d'arriver tant que le contrat
     court : mieux vaut l'écrire que laisser espérer un silence qui ne viendra
     pas. Cette version-là ne pose aucun en-tête de désabonnement, sans quoi le
     bouton de Gmail promettrait à son tour ce qu'on ne tiendra pas.

     Sans identifiant — un appelant qui passerait une adresse libre — rien n'est
     signable : on renvoie alors vers l'espace adhérent plutôt que d'afficher un
     lien mort. */
  static newsletterFooter(recipientId, respectsOptOut) {
    // Même ordre que les autres messages : motif, droits, désabonnement.
    const motif = 'Vous recevez cet email parce que vous êtes adhérent(e) de l\'AMAP Aux P\'tits Pois.';

    if (!recipientId) {
      return {
        html: `${motif}<br>${droitsViaEspace()}`,
      };
    }

    const unsubLink = escapeHtml(unsubscribePageUrl(recipientId));

    if (!respectsOptOut) {
      return {
        html: `Ce message concerne votre contrat en cours : il vous parvient même si vous avez quitté la lettre d'information.<br>
               ${droitsViaEspace()}<br>
               <a href="${unsubLink}">Gérer mes emails</a>`,
      };
    }

    return {
      headers: unsubscribeHeaders(recipientId),
      html: `${motif}<br>
             ${droitsViaEspace()}<br>
             <a href="${unsubLink}">Me désabonner</a>`,
    };
  }

  /* `onProgress` est appelé à la fin de chaque lot, pas à chaque message :
     l'envoi se poursuit hors de la requête, l'écran lit l'avancement en base. */
  async sendNewsletter(newsletter, recipients, { onProgress } = {}) {
    try {
      const results = { sent: 0, failed: 0, errors: [] };
      const batchSize = 50;
      const respectsOptOut = !overridesOptOut(newsletter.type);

      // Rendre compte ne doit pas interrompre ce dont on rend compte.
      const rapporter = async () => {
        if (!onProgress) return;

        try {
          await onProgress({ sent: results.sent, failed: results.failed });
        } catch (error) {
          console.error(`[Email:NEWSLETTER] progression non enregistrée : ${error.message}`);
        }
      };

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        for (const recipient of batch) {
          const footer = EmailService.newsletterFooter(recipient.id, respectsOptOut);

          // #send ne lève jamais : on lit le verdict et on continue la liste.
          const envoi = await this.#send({
            from: EMAIL_FROM,
            to: recipient.email,
            subject: newsletter.subject,
            ...(footer.headers && { headers: footer.headers }),
            /* Le sujet coiffe le message : le lecteur sait de quoi il s'agit
               avant d'avoir lu la première ligne. Échappé, parce qu'il est
               saisi à la main dans l'écran d'administration et qu'il entre
               ici dans du HTML — un chevron mal placé casserait la page. */
            html: renderEmail({
              title: escapeHtml(newsletter.subject),
              /* Le sur-titre doit dire la même chose que le pied de page :
                 une alerte n'est pas la lettre d'information, puisqu'elle
                 arrive même à qui s'en est désabonné. */
              eyebrow: respectsOptOut ? 'Lettre d\'information' : 'Information de service',
              content: DOMPurify.sanitize(EmailService.formatNewsletterBody(newsletter.content)),
              footerNote: footer.html,
            }),
          }, { kind: 'NEWSLETTER', ref: newsletter.id });

          if (envoi.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({ email: recipient.email, error: envoi.error });
          }
        }
        await rapporter();

        if (i + batchSize < recipients.length) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /* Envoie un email de confirmation d'abonnement créé */
  /* Deux chemins mènent ici : l'administration qui crée un contrat déjà actif,
     et l'approbation d'une demande, qui le laisse en attente de règlement.
     Annoncer « activé » dans le second cas envoie l'adhérent à une distribution
     où il ne figure sur aucune liste. Le statut du contrat commande donc le
     texte, et le doute penche vers l'attente : on n'annonce jamais une
     activation dont on n'est pas sûr. */
  async sendSubscriptionConfirmation(subscription, user, { paymentType = null } = {}) {
    const active = subscription.status === 'ACTIVE';

    const echeances = paymentType
      ? ` : ${formatInstallments(splitPayment(subscription.price, paymentType))} à l'ordre d'Aux P'tits Pois, à remettre lors d'une distribution`
      : ', par chèque à l\'ordre d\'Aux P\'tits Pois, à remettre lors d\'une distribution';

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: active ? 'Votre abonnement est activé !' : 'Votre abonnement est enregistré',
      html: renderEmail({
        title: active ? 'Bienvenue dans l\'aventure' : 'Votre abonnement est enregistré',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            ${active
              ? '<p>Félicitations ! Votre abonnement Aux P\'tits Pois est maintenant <strong>activé</strong>.</p>'
              : '<p>Votre demande est validée : le contrat est enregistré à votre nom.</p>'}
            <div class="info-box">
              <h3>Votre abonnement</h3>
              <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
              <p><strong>Type :</strong> ${subscription.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte'}</p>
              <p><strong>Panier :</strong> ${subscription.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}</p>
            </div>
            ${active ? '' : `<div class="warning"><strong>Il reste une étape :</strong> votre abonnement sera activé à réception de votre règlement${echeances}. Tant qu'il ne l'est pas, aucun panier ne vous est réservé le mercredi.</div>`}
            <div class="highlight">
              <h3>${active ? 'Retrait de votre panier' : 'Votre point de retrait'}</h3>
              <p><strong>Chaque mercredi de 18h15 à 19h15</strong><br>
              ${escapeHtml(subscription.pickupLocation.name)}<br>
              ${escapeHtml(subscription.pickupLocation.address)}</p>
            </div>
            <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, active
          ? 'suite à l\'activation de votre contrat'
          : 'suite à l\'enregistrement de votre contrat'),
      }),
    }, { kind: 'SUBSCRIPTION_CONFIRMATION', ref: subscription.id });
  }

  /* Envoie un rappel de renouvellement */
  async sendRenewalReminderEmail(subscription, user) {
    const type = subscription.type === 'ANNUAL' ? 'Annuel' : 'Découverte';

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre abonnement Aux P\'tits Pois expire bientôt',
      html: renderEmail({
        title: 'Votre abonnement expire bientôt',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Votre abonnement Aux P'tits Pois arrive à échéance dans <strong>30 jours</strong>.</p>
            <div class="info-box">
              <h3>Votre abonnement actuel</h3>
              <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
              <p><strong>Type :</strong> ${type}</p>
            </div>
            <div class="warning">
              Sans renouvellement, votre abonnement sera automatiquement clôturé à l'échéance et vous ne recevrez plus de paniers.
            </div>
            ${emailButton(`${process.env.FRONTEND_URL}/nos-abonnements`, 'Renouveler mon abonnement')}
            <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'parce que votre contrat arrive à échéance'),
      }),
    }, { kind: 'RENEWAL_REMINDER', ref: subscription.id });
  }

  /* Chèque : avis d'encaissement à venir, envoyé un mois avant le dépôt.

     L'adhérent a signé son contrat en février et remis quatre chèques d'un
     coup ; en juin il ne sait plus lequel part quand, ni s'il en reste. Cet
     avis lui rend cette information au moment où elle sert : avant que la
     banque ne prélève, assez tôt pour approvisionner le compte.

     Le rang du chèque (« 3ᵉ sur 4 ») compte autant que le montant : c'est ce
     qui lui dit combien il en reste après celui-là. */
  async sendChequeDepositNotice({ payment, subscription, user, rang, total }) {
    const montant = euroAmount(payment.amount);
    const echeance = longDate(payment.dueDate);
    const rangTexte = rang === total
      ? 'Dernier chèque de votre contrat'
      : `${rang}${rang === 1 ? 'er' : 'e'} chèque sur ${total}`;

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: `Votre chèque de ${montant} sera déposé le ${echeance}`,
      html: renderEmail({
        title: 'Un chèque va être déposé',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Nous vous informons qu'un des chèques remis pour votre abonnement sera porté en banque le <strong>${echeance}</strong>.</p>
            <div class="info-box">
              <p class="amount" style="margin:0 0 8px;">${montant}</p>
              <p>${rangTexte}, abonnement n° ${escapeHtml(subscription.subscriptionNumber)}.</p>
            </div>
            <p>Merci de vérifier que votre compte est approvisionné à cette date. Un chèque rejeté nous oblige à vous recontacter, et engendre des frais pour l'association comme pour vous.</p>
            <div class="note">
              Ce montant est celui inscrit sur votre contrat. Une suspension de panier ne le modifie pas : l'engagement porte sur la saison entière.
            </div>
            ${emailButton(`${process.env.FRONTEND_URL}/compte`, 'Voir mes chèques')}
            <p>Merci de votre soutien,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'parce qu\'un chèque de votre contrat arrive à échéance'),
      }),
    }, { kind: 'CHEQUE_DEPOSIT_NOTICE', ref: payment.id });
  }

  /* Chèques : récapitulatif des dépôts à faire, pour le trésorier.

     Un seul email pour toute la remise, et non un par chèque : la boîte du
     trésorier reçoit une liste qu'il emporte à la banque, pas trente messages
     qu'il finirait par archiver sans lire.

     Les chèques en retard ouvrent la liste et sont marqués : ce sont les seuls
     sur lesquels une action est déjà due. */
  async sendTreasurerChequeDigest(lignes) {
    const destinataire = process.env.TREASURER_EMAIL;
    if (!destinataire) {
      // Sans cette ligne, une remise jamais annoncée ressemble à une remise vide.
      console.error('[Email:TREASURER_CHEQUE_DIGEST] TREASURER_EMAIL non configurée, récapitulatif non envoyé');
      return { success: false, error: 'TREASURER_EMAIL non configurée' };
    }

    const total = lignes.reduce((somme, ligne) => somme + ligne.amount, 0);
    const retards = lignes.filter((ligne) => ligne.enRetard).length;

    const rangs = lignes.map((ligne) => `
        <tr${ligne.enRetard ? ' class="row-late"' : ''}>
          <td>
            ${escapeHtml(ligne.nom)}<br>
            <span class="cell-muted">${escapeHtml(ligne.subscriptionNumber)}</span>
          </td>
          <td style="text-align:right; white-space:nowrap;">
            <strong>${euroAmount(ligne.amount)}</strong>
          </td>
          <td style="white-space:nowrap;">
            ${longDate(ligne.dueDate)}
            ${ligne.enRetard ? '<br><span class="tag-late">en retard</span>' : ''}
          </td>
          <td class="cell-muted">
            ${ligne.checkNumber ? `n° ${escapeHtml(ligne.checkNumber)}` : '—'}
          </td>
        </tr>
      `).join('');

    return this.#send({
      from: EMAIL_FROM,
      to: destinataire,
      subject: `${lignes.length} chèque${lignes.length > 1 ? 's' : ''} à déposer en banque${retards > 0 ? ` (dont ${retards} en retard)` : ''}`,
      html: renderEmail({
        title: 'Chèques à porter en banque',
        eyebrow: 'Trésorerie',
        content: `
            <p>Bonjour,</p>
            <p>${lignes.length} chèque${lignes.length > 1 ? 's arrivent' : ' arrive'} à échéance. Voici la remise à préparer :</p>
            <table class="listing">
              <thead>
                <tr><th>Adhérent</th><th style="text-align:right;">Montant</th><th>Échéance</th><th>Chèque</th></tr>
              </thead>
              <tbody>${rangs}</tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td style="text-align:right;"><strong>${euroAmount(total)}</strong></td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
            <p>Une fois la remise déposée, marquez ces chèques « remis en banque » depuis la fiche de chaque abonnement : c'est ce qui met à jour l'espace de l'adhérent et arrête ce rappel.</p>
            ${emailButton(`${process.env.FRONTEND_URL}/admin/abonnements`, 'Ouvrir les abonnements')}`,
        // Destinataire interne, comme le formulaire de contact.
        footerNote: 'Message automatique destiné à la trésorerie de l\'association.',
      }),
    }, { kind: 'TREASURER_CHEQUE_DIGEST', ref: null });
  }

  /* Permanence : Confirmation */
  async sendShiftConfirmation(shift, user) {
    const date = new Date(shift.distributionDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Confirmation d\'inscription à une permanence - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Inscription confirmée',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Votre inscription à la permanence est <strong>confirmée</strong>.</p>
            <div class="info-box">
              <h3>Détails de la permanence</h3>
              <p><strong>Date :</strong> ${date}</p>
              ${shift.startTime ? `<p><strong>Horaire :</strong> ${escapeHtml(shift.startTime)}${shift.endTime ? ` - ${escapeHtml(shift.endTime)}` : ''}</p>` : ''}
            </div>
            <p>Merci pour votre engagement dans l'AMAP !</p>
            <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'suite à votre inscription à une permanence'),
      }),
    }, { kind: 'SHIFT_CONFIRMATION', ref: shift.id });
  }

  /* Permanence : Annulation */
  async sendShiftCancellation(shift, user) {
    const date = new Date(shift.distributionDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Permanence annulée - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Permanence annulée',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Nous vous informons que la permanence à laquelle vous étiez inscrit(e) a été <strong>annulée</strong>.</p>
            <div class="info-box">
              <h3>Permanence concernée</h3>
              <p><strong>Date :</strong> ${date}</p>
            </div>
            <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'parce que vous étiez inscrit(e) à cette permanence'),
      }),
    }, { kind: 'SHIFT_CANCELLATION', ref: shift.id });
  }

  /* Abonnement : Annulation */
  async sendSubscriptionCancellation(subscription, user) {
    const type = subscription.type === 'ANNUAL' ? 'Annuel' : 'Découverte';
    const basket = subscription.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)';

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre abonnement Aux P\'tits Pois a été annulé',
      html: renderEmail({
        title: 'Abonnement annulé',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Nous vous informons que votre abonnement Aux P'tits Pois a été <strong>annulé</strong>.</p>
            <div class="info-box">
              <h3>Abonnement concerné</h3>
              <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
              <p><strong>Type :</strong> ${type}</p>
              <p><strong>Panier :</strong> ${basket}</p>
            </div>
            <p>Si vous avez des questions ou souhaitez vous réabonner, écrivez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.</p>
            <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'suite à l\'annulation de votre contrat'),
      }),
    }, { kind: 'SUBSCRIPTION_CANCELLATION', ref: subscription.id });
  }

  /* La pause est demandée de vive voix et saisie par un bénévole : ce message est
     la seule trace écrite que l'adhérent en garde, d'où les dates et le quota
     restant, qu'il ne peut lire nulle part ailleurs. */
  async sendSubscriptionPaused(subscription, user, { startDate, endDate, joursRestants }) {
    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre pause est enregistrée - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Votre pause est enregistrée',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Vos paniers sont suspendus <strong>du ${longDate(startDate)} au ${longDate(endDate)}</strong>. Aucun panier ne sera préparé pendant cette période, vous n'avez rien à faire.</p>
            <p>Votre abonnement reprend ensuite tout seul, sans démarche de votre part : vous recevrez un message le jour venu.</p>
            <div class="info-box">
              <h3>Votre abonnement</h3>
              <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
              <p><strong>Pause restante cette saison :</strong> ${joursRestants} jour${joursRestants > 1 ? 's' : ''} sur 14</p>
            </div>
            <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'suite à la mise en pause de votre contrat'),
      }),
    }, { kind: 'SUBSCRIPTION_PAUSED', ref: subscription.id });
  }

  /* Le pendant du précédent, et le seul qui compte vraiment : une reprise que
     personne n'annonce, c'est un panier préparé pour quelqu'un qui ne viendra
     pas le chercher. */
  async sendSubscriptionResumed(subscription, user) {
    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre abonnement reprend - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Votre abonnement reprend',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Votre pause est terminée : votre abonnement Aux P'tits Pois est de nouveau <strong>actif</strong>, et un panier vous est préparé dès la prochaine distribution.</p>
            <div class="highlight">
              <h3>Retrait de votre panier</h3>
              <p><strong>Chaque mercredi de 18h15 à 19h15</strong><br>
              ${escapeHtml(subscription.pickupLocation.name)}<br>
              ${escapeHtml(subscription.pickupLocation.address)}</p>
            </div>
            <p>À mercredi,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'suite à la reprise de votre contrat'),
      }),
    }, { kind: 'SUBSCRIPTION_RESUMED', ref: subscription.id });
  }

  /* Le rappel envoyé un mois plus tôt annonce une clôture « automatique à
     l'échéance » : ce message est celui qui la constate. Sans lui, l'adhérent
     ignore que son contrat est clos et que la voie du réabonnement est ouverte. */
  async sendSubscriptionExpired(subscription, user) {
    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre abonnement est arrivé à échéance',
      html: renderEmail({
        title: 'Votre abonnement est arrivé à échéance',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Votre abonnement Aux P'tits Pois s'est achevé le ${longDate(subscription.endDate)}. Il est désormais clos, et aucun panier ne vous est plus préparé.</p>
            <div class="info-box">
              <h3>Abonnement clos</h3>
              <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
              <p><strong>Type :</strong> ${subscription.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte'}</p>
            </div>
            <p>Nous serions heureux de vous compter à nouveau parmi nos adhérents : une nouvelle demande se fait en quelques minutes.</p>
            ${emailButton(`${process.env.FRONTEND_URL}/nos-abonnements`, 'Se réabonner')}
            <p>Merci pour cette saison,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'suite à l\'échéance de votre contrat'),
      }),
    }, { kind: 'SUBSCRIPTION_EXPIRED', ref: subscription.id });
  }

  /* Candidature producteur : Acceptée */
  async sendProducerInquiryAccepted(inquiry) {
    return this.#send({
      from: EMAIL_FROM,
      to: inquiry.email,
      subject: 'Votre candidature a été acceptée - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Candidature acceptée',
        content: `
            <p>Bonjour ${escapeHtml(inquiry.firstName)},</p>
            <p>Nous avons le plaisir de vous informer que la candidature de <strong>${escapeHtml(inquiry.farmName)}</strong> a été <strong>acceptée</strong> par l'AMAP Aux P'tits Pois.</p>
            <div class="info-box">
              <h3>Prochaines étapes</h3>
              <ol>
                <li>Nous vous contacterons prochainement pour organiser une rencontre</li>
                <li>Nous définirons ensemble les modalités du partenariat</li>
                <li>Votre exploitation sera présentée à nos adhérents</li>
              </ol>
            </div>
            <p>Pour toute question, écrivez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.</p>
            <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNoteSansCompte(inquiry.email, 'suite à votre candidature de producteur'),
      }),
    }, { kind: 'PRODUCER_INQUIRY_ACCEPTED', ref: inquiry.id });
  }

  /* Candidature producteur : Rejetée */
  async sendProducerInquiryRejected(inquiry) {
    return this.#send({
      from: EMAIL_FROM,
      to: inquiry.email,
      subject: 'Votre candidature - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Réponse à votre candidature',
        content: `
            <p>Bonjour ${escapeHtml(inquiry.firstName)},</p>
            <p>Nous avons bien étudié la candidature de <strong>${escapeHtml(inquiry.farmName)}</strong> et nous vous remercions de l'intérêt que vous portez à notre AMAP.</p>
            <p>Après examen, nous ne sommes malheureusement pas en mesure de donner suite à votre candidature pour le moment.</p>
            <p>Pour toute question, n'hésitez pas à nous écrire à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.</p>
            <p>Cordialement,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNoteSansCompte(inquiry.email, 'suite à votre candidature de producteur'),
      }),
    }, { kind: 'PRODUCER_INQUIRY_REJECTED', ref: inquiry.id });
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
        return `<li>${escapeHtml(name)}</li>`;
      }).join('');

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        for (const recipient of batch) {
          const envoi = await this.#send({
            from: EMAIL_FROM,
            to: recipient.email,
            subject: `Votre panier de la semaine - ${distDate}`,
            html: renderEmail({
              title: 'Au menu cette semaine',
              eyebrow: 'Panier de la semaine',
              content: `
                  <p>Bonjour ${escapeHtml(recipient.firstName)},</p>
                  <p>Le panier de la semaine est prêt. Voici ce que nos producteurs ont récolté pour votre distribution du <strong>${distDate}</strong> :</p>
                  <div class="basket-box">
                    <p class="basket-title">Contenu du panier</p>
                    <ul class="product-list">
                      ${productsHtml}
                    </ul>
                  </div>
                  <p style="font-size:13px; text-align:center;">
                    Le contenu peut varier légèrement, au gré des aléas de dernière minute à la récolte.
                  </p>
                  <p>N'oubliez pas vos sacs et cabas pour rapporter vos légumes.</p>
                  <p>À mercredi,<br>L'équipe Aux P'tits Pois</p>`,
              footerNote: rgpdNote(recipient.email, 'parce que vous avez un abonnement actif'),
            }),
          }, { kind: 'WEEKLY_BASKET', ref: basket.id });

          if (envoi.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({ email: recipient.email, error: envoi.error });
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
    const date = new Date(shift.distributionDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Désinscription confirmée - Aux P\'tits Pois',
      html: renderEmail({
        title: 'Désinscription confirmée',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Votre désinscription de la permanence a bien été enregistrée.</p>
            <div class="info-box">
              <h3>Permanence concernée</h3>
              <p><strong>Date :</strong> ${date}</p>
            </div>
            <p>Si vous souhaitez vous inscrire à une autre permanence, rendez-vous sur <a href="${process.env.FRONTEND_URL}/permanences">votre espace adhérent</a>.</p>
            <p>À bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'suite à votre désinscription d\'une permanence'),
      }),
    }, { kind: 'SHIFT_WITHDRAWAL', ref: shift.id });
  }
}

export default new EmailService();