/* Le catalogue des messages du site, partagé par les tests.

   Écrit à la main plutôt que dérivé du service : c'est l'écart entre les deux
   que le test de complétude doit voir.

   `public` dit vers quelle porte la mention des droits doit conduire —
   « adherent » l'espace, « candidat » l'adresse de l'association, « interne »
   aucune. */

import {
  adherente,
  candidateProductrice,
  contrat,
  contratEnAttente,
  demandeAbonnement,
  permanence,
  cheque,
  ligneDeRemise,
  panierHebdomadaire,
  lettreDInformation,
  annonceDeService,
} from './destinataires.js';

export function messagesSortants(emails) {
  return [
    {
      nom: 'bienvenue', methode: 'sendWelcomeEmail', kind: 'WELCOME', public: 'adherent',
      envoyer: () => emails.sendWelcomeEmail(adherente),
    },
    {
      nom: 'vérification d\'adresse', methode: 'sendEmailVerification', kind: 'EMAIL_VERIFICATION', public: 'adherent',
      envoyer: () => emails.sendEmailVerification(adherente, 'jeton-de-test'),
    },
    {
      nom: 'compte déjà existant', methode: 'sendAccountAlreadyExists', kind: 'ACCOUNT_ALREADY_EXISTS', public: 'adherent',
      envoyer: () => emails.sendAccountAlreadyExists(adherente),
    },
    {
      nom: 'mot de passe oublié', methode: 'sendPasswordResetEmail', kind: 'PASSWORD_RESET', public: 'adherent',
      envoyer: () => emails.sendPasswordResetEmail(adherente, 'jeton-de-test'),
    },
    {
      nom: 'mot de passe modifié', methode: 'sendPasswordChanged', kind: 'PASSWORD_CHANGED', public: 'adherent',
      envoyer: () => emails.sendPasswordChanged(adherente),
    },
    {
      nom: 'demande d\'abonnement reçue', methode: 'sendSubscriptionRequestConfirmation', kind: 'SUBSCRIPTION_REQUEST_CONFIRMATION', public: 'adherent',
      envoyer: () => emails.sendSubscriptionRequestConfirmation(demandeAbonnement),
    },
    {
      nom: 'contrat activé', methode: 'sendSubscriptionConfirmation', kind: 'SUBSCRIPTION_CONFIRMATION', public: 'adherent',
      envoyer: () => emails.sendSubscriptionConfirmation(contrat, adherente),
    },
    {
      nom: 'contrat enregistré, règlement attendu', methode: 'sendSubscriptionConfirmation', kind: 'SUBSCRIPTION_CONFIRMATION', public: 'adherent',
      envoyer: () => emails.sendSubscriptionConfirmation(contratEnAttente, adherente, { paymentType: '4' }),
    },
    {
      nom: 'contrat bientôt échu', methode: 'sendRenewalReminderEmail', kind: 'RENEWAL_REMINDER', public: 'adherent',
      envoyer: () => emails.sendRenewalReminderEmail(contrat, adherente),
    },
    {
      nom: 'contrat annulé', methode: 'sendSubscriptionCancellation', kind: 'SUBSCRIPTION_CANCELLATION', public: 'adherent',
      envoyer: () => emails.sendSubscriptionCancellation(contrat, adherente),
    },
    {
      nom: 'chèque bientôt déposé', methode: 'sendChequeDepositNotice', kind: 'CHEQUE_DEPOSIT_NOTICE', public: 'adherent',
      envoyer: () => emails.sendChequeDepositNotice({ payment: cheque, subscription: contrat, user: adherente, rang: 3, total: 4 }),
    },
    {
      nom: 'permanence confirmée', methode: 'sendShiftConfirmation', kind: 'SHIFT_CONFIRMATION', public: 'adherent',
      envoyer: () => emails.sendShiftConfirmation(permanence, adherente),
    },
    {
      nom: 'permanence annulée', methode: 'sendShiftCancellation', kind: 'SHIFT_CANCELLATION', public: 'adherent',
      envoyer: () => emails.sendShiftCancellation(permanence, adherente),
    },
    {
      nom: 'désinscription d\'une permanence', methode: 'sendShiftWithdrawal', kind: 'SHIFT_WITHDRAWAL', public: 'adherent',
      envoyer: () => emails.sendShiftWithdrawal(permanence, adherente),
    },
    {
      nom: 'panier de la semaine', methode: 'sendWeeklyBasketNotification', kind: 'WEEKLY_BASKET', public: 'adherent',
      envoyer: () => emails.sendWeeklyBasketNotification(panierHebdomadaire, [{ ...adherente }]),
    },
    {
      nom: 'lettre d\'information', methode: 'sendNewsletter', kind: 'NEWSLETTER', public: 'adherent',
      envoyer: () => emails.sendNewsletter(lettreDInformation, [{ ...adherente }]),
    },
    {
      nom: 'annonce de service', methode: 'sendNewsletter', kind: 'NEWSLETTER', public: 'adherent',
      envoyer: () => emails.sendNewsletter(annonceDeService, [{ ...adherente }]),
    },
    {
      nom: 'candidature reçue', methode: 'sendProducerInquiryConfirmation', kind: 'PRODUCER_INQUIRY_CONFIRMATION', public: 'candidat',
      envoyer: () => emails.sendProducerInquiryConfirmation(candidateProductrice),
    },
    {
      nom: 'candidature acceptée', methode: 'sendProducerInquiryAccepted', kind: 'PRODUCER_INQUIRY_ACCEPTED', public: 'candidat',
      envoyer: () => emails.sendProducerInquiryAccepted(candidateProductrice),
    },
    {
      nom: 'candidature refusée', methode: 'sendProducerInquiryRejected', kind: 'PRODUCER_INQUIRY_REJECTED', public: 'candidat',
      envoyer: () => emails.sendProducerInquiryRejected(candidateProductrice),
    },
    {
      nom: 'message de contact', methode: 'sendContactMessage', kind: 'CONTACT_MESSAGE', public: 'interne',
      envoyer: () => emails.sendContactMessage({ name: 'Paul Girard', email: 'paul@example.org', subject: 'Une question', message: 'Bonjour' }),
    },
    {
      nom: 'remise de chèques', methode: 'sendTreasurerChequeDigest', kind: 'TREASURER_CHEQUE_DIGEST', public: 'interne',
      envoyer: () => emails.sendTreasurerChequeDigest([ligneDeRemise]),
    },
  ];
}
