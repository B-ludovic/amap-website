import nodemailer from 'nodemailer';
import DOMPurify from 'isomorphic-dompurify';
import { prisma } from '../config/database.js';
import { euroAmount } from '../utils/subscriptionPricing.js';
import { overridesOptOut } from './newsletterAudience.service.js';
import { unsubscribePageUrl, unsubscribeHeaders } from '../utils/unsubscribeToken.js';
import { renderEmail, emailButton } from './emailTheme.js';

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

/* L'adresse de l'association : boîte de réception du formulaire de contact,
   et porte de sortie pour qui n'a pas d'espace adhérent. Elle était recopiée
   dans six messages ; le jour où l'AMAP en changera, c'est ici que ça se
   passera. */
const AMAP_EMAIL = 'auxptitspois@gmail.com';

/* La mention RGPD du pied de page : pourquoi cette adresse précise reçoit ce
   message précis, et par quelle porte reprendre la main sur ses données.

   Deux portes, parce qu'il y a deux publics. L'adhérent a un espace où tout se
   consulte, s'exporte et s'efface en quelques clics. Le candidat producteur,
   lui, n'a pas de compte : l'envoyer vers « votre espace adhérent » serait le
   diriger vers une porte fermée, et un droit qu'on ne peut pas exercer ne vaut
   guère mieux qu'un droit qu'on ne mentionne pas. Sa porte à lui est l'adresse
   de l'association — celle-là même que le corps du message lui donne déjà pour
   toute question.

   La phrase est volontairement identique des deux côtés : c'est la destination
   qui change, jamais la promesse. */
const droitsViaEspace = () =>
  `Pour consulter, modifier ou supprimer vos données, <a href="${escapeHtml(`${process.env.FRONTEND_URL}/compte`)}">ouvrez votre espace adhérent</a>.`;

const droitsViaEmail = () =>
  `Pour consulter, modifier ou supprimer vos données, écrivez-nous à <a href="mailto:${AMAP_EMAIL}">${AMAP_EMAIL}</a>.`;

const rgpdNote = (email, raison) =>
  `Cet email a été envoyé à ${escapeHtml(email)} ${raison}.<br>${droitsViaEspace()}`;

const rgpdNoteSansCompte = (email, raison) =>
  `Cet email a été envoyé à ${escapeHtml(email)} ${raison}.<br>${droitsViaEmail()}`;

class EmailService {

  /* Le point de passage unique de tout message sortant.

     Avant, chaque méthode portait sa propre copie du même try/catch : dix-neuf
     copies, dont six seulement journalisaient quelque chose. Les treize autres
     avalaient l'échec en silence et rendaient un { success: false } que quinze
     appelants sur dix-huit jetaient sans le lire. Un mardi soir, quatre
     bénévoles à prévenir de l'annulation d'une permanence, une erreur de quota
     sur le deuxième message : l'interface affichait « supprimée avec succès » et
     rien nulle part ne disait lesquels avaient été prévenus.

     Une seule porte, donc, par laquelle tout passe. Ce qui en sort est double :
     une ligne de log pour l'équipe technique, et une ligne en base pour tous les
     autres — c'est celle-là qui répond à « l'adhérente Machin a-t-elle reçu sa
     confirmation le 12 mars ? », une question qu'aucun log rotatif ne sait
     tenir. La valeur de retour ne change pas de forme : les appelants qui la
     lisaient déjà continuent de fonctionner à l'identique. */
  async #send(mailOptions, { kind, ref = null }) {
    try {
      const info = await transporter.sendMail(mailOptions);
      await this.#trace({ kind, ref, mailOptions, status: 'SENT', messageId: info?.messageId ?? null });

      if (process.env.NODE_ENV !== 'production') console.log(`[Email:${kind}] envoyé à ${mailOptions.to}`);

      return { success: true };
    } catch (error) {
      /* L'adresse du destinataire reste hors du flux de logs en production :
         c'est une donnée personnelle, et les journaux de l'hébergeur se
         conservent sans être une base de données (même règle que
         error.middleware.js). Elle est enregistrée juste en dessous, dans
         EmailLog, qui est purgé et dont l'accès est contrôlé. */
      const destinataire = process.env.NODE_ENV === 'production' ? '[adresse en base]' : mailOptions.to;
      console.error(`[Email:${kind}] échec d'envoi vers ${destinataire} : ${error.message}`);

      await this.#trace({ kind, ref, mailOptions, status: 'FAILED', error: error.message });

      return { success: false, error: error.message };
    }
  }

  /* La trace ne doit jamais faire tomber l'envoi qu'elle décrit.

     Si la base est injoignable au moment où l'on veut écrire la ligne, laisser
     l'exception remonter transformerait un email parti avec succès en erreur
     500 pour l'administratrice — et, sur l'appel non attendu des paniers
     hebdomadaires, en rejet de promesse non capturé, ce qui arrête le processus
     Node. L'échec d'écriture se journalise donc et s'arrête là.

     On n'enregistre que l'enveloppe. Le HTML rendu porte le prénom, l'adresse de
     retrait, le contenu du panier : le garder reviendrait à tenir une copie de
     la boîte mail de chaque adhérent, ce qu'aucune finalité ne justifie. */
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
        /* Seul message dont la porte dépend de la donnée reçue. La route
           actuelle exige d'être connecté, donc userId est toujours là ; mais
           le modèle le déclare optionnel et la purge RGPD compte déjà des
           « demandes d'abonnement sans compte ». Le jour où un formulaire
           public rouvrira ce chemin, la mention suivra d'elle-même au lieu
           d'envoyer vers un espace adhérent qui n'existe pas. */
        footerNote: request.userId
          ? rgpdNote(request.email, 'suite à votre demande d\'abonnement')
          : rgpdNoteSansCompte(request.email, 'suite à votre demande d\'abonnement'),
      }),
    }, { kind: 'SUBSCRIPTION_REQUEST_CONFIRMATION', ref: request.id });
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
        /* Seul message, avec la remise de chèques, à ne porter aucune mention
           RGPD — et c'est volontaire : il arrive dans la boîte de
           l'association, pas dans celle de la personne dont il parle. */
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
    /* Le même ordre et les mêmes mots que dans les dix-sept autres messages :
       le motif, puis les droits, puis le désabonnement. Le lien « Gérer mes
       préférences » d'avant menait déjà à /compte : la phrase des droits mène
       au même endroit, en disant ce qu'on y trouve. */
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

  /* Envoie une newsletter.

     `onProgress` est appelé à la fin de chaque lot, avec le compte courant.
     L'envoi ne se fait plus dans la requête de l'administratrice — deux cents
     adhérents demandent près de deux minutes, cinq cents plus de quatre — et
     elle a donc besoin de voir la progression ailleurs que dans une roue qui
     tourne. Le rapporteur écrit en base ; c'est de là que l'écran lit.

     Il est appelé entre les lots et non à chaque message : cinq cents écritures
     pour cinq cents envois coûteraient plus cher que l'envoi lui-même, et
     personne ne regarde un compteur avancer message par message. */
  async sendNewsletter(newsletter, recipients, { onProgress } = {}) {
    try {
      const results = { sent: 0, failed: 0, errors: [] };
      const batchSize = 50;
      const respectsOptOut = !overridesOptOut(newsletter.type);

      /* Rendre compte ne doit jamais interrompre ce dont on rend compte : une
         base momentanément injoignable ferait sinon échouer un envoi qui se
         déroule très bien. Même règle que pour la trace dans #trace. */
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

          /* Un envoi de masse ne s'arrête pas au premier refus : #send ne lève
             jamais, on lit donc son verdict et on continue la liste. Chaque
             destinataire laisse sa propre ligne dans EmailLog, ce qui permet de
             répondre après coup à « qui n'a pas reçu l'annonce ? » sans avoir à
             conserver ce tableau d'erreurs. */
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
  async sendSubscriptionConfirmation(subscription, user) {
    return this.#send({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Votre abonnement est activé !',
      html: renderEmail({
        title: 'Bienvenue dans l\'aventure',
        content: `
            <p>Bonjour ${escapeHtml(user.firstName)},</p>
            <p>Félicitations ! Votre abonnement Aux P'tits Pois est maintenant <strong>activé</strong>.</p>
            <div class="info-box">
              <h3>Votre abonnement</h3>
              <p><strong>N° :</strong> ${escapeHtml(subscription.subscriptionNumber)}</p>
              <p><strong>Type :</strong> ${subscription.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte'}</p>
              <p><strong>Panier :</strong> ${subscription.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}</p>
            </div>
            <div class="highlight">
              <h3>Retrait de votre panier</h3>
              <p><strong>Chaque mercredi de 18h15 à 19h15</strong><br>
              ${escapeHtml(subscription.pickupLocation.name)}<br>
              ${escapeHtml(subscription.pickupLocation.address)}</p>
            </div>
            <p>À très bientôt,<br>L'équipe Aux P'tits Pois</p>`,
        footerNote: rgpdNote(user.email, 'suite à l\'activation de votre contrat'),
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
      /* Rien ne part, donc rien à tracer — mais l'absence de configuration doit
         s'entendre : sans cette ligne, une remise de chèques jamais annoncée
         ressemblerait à une remise sans chèque à déposer. */
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
        /* Destinataire interne, comme le formulaire de contact : rien à
           mentionner à quelqu'un sur ses propres données. */
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