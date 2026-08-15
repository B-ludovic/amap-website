/* Les personnes et les objets qui servent de matière aux tests.

   Trois publics, parce que les mentions du pied de page en dépendent :
   l'adhérente, qui a un espace où exercer ses droits ; la candidate
   productrice, qui n'a pas de compte et à qui il faut donc une autre porte ;
   et l'association elle-même, destinataire de ses propres messages internes.

   Les adresses sont en .test et .example, réservées par la RFC 2606 : aucune ne
   peut appartenir à quelqu'un, même par accident. */

export const adherente = {
  id: 'utilisateur-de-test-0001',
  firstName: 'Camille',
  lastName: 'Renard',
  email: 'camille@example.org',
};

export const candidateProductrice = {
  id: 'candidature-de-test-0001',
  firstName: 'Nadia',
  farmName: 'Ferme des Trois Chênes',
  email: 'nadia@example.net',
};

export const contrat = {
  id: 'contrat-de-test-0001',
  subscriptionNumber: 'AMAP-2026-0142',
  type: 'ANNUAL',
  basketSize: 'SMALL',
  pricingType: 'NORMAL',
  pickupLocation: {
    name: 'Salle des fêtes',
    address: '2 place de la Mairie, 45300 Yèvre-la-Ville',
  },
};

/* La demande d'abonnement porte son userId : c'est ce qui décide de la porte
   proposée dans le pied de page. La variante sans compte est construite dans le
   test lui-même, pour que le contraste se lise sur place. */
export const demandeAbonnement = {
  id: 'demande-de-test-0001',
  userId: adherente.id,
  firstName: adherente.firstName,
  email: adherente.email,
  type: 'ANNUAL',
  basketSize: 'SMALL',
  pricingType: 'NORMAL',
};

export const permanence = {
  id: 'permanence-de-test-0001',
  distributionDate: '2026-09-02T16:00:00.000Z',
  startTime: '18h00',
  endTime: '19h30',
};

export const cheque = {
  id: 'cheque-de-test-0001',
  amount: 365,
  dueDate: '2026-10-01T00:00:00.000Z',
};

export const ligneDeRemise = {
  nom: 'Camille Renard',
  subscriptionNumber: contrat.subscriptionNumber,
  amount: 365,
  dueDate: '2026-10-01T00:00:00.000Z',
  checkNumber: '0004312',
  enRetard: false,
};

export const panierHebdomadaire = {
  id: 'panier-de-test-0001',
  distributionDate: '2026-09-02T16:00:00.000Z',
  items: [
    { customProductName: 'Courgettes' },
    { product: { name: 'Tomates anciennes' } },
  ],
};

export const lettreDInformation = {
  id: 'newsletter-de-test-0001',
  subject: 'Les nouvelles du mois',
  type: 'NEWSLETTER',
  content: 'Bonjour à toutes et à tous,\nLa distribution de mercredi est maintenue.',
};

export const annonceDeService = {
  id: 'newsletter-de-test-0002',
  subject: 'Distribution annulée mercredi',
  type: 'ALERT',
  content: '<p>La distribution de mercredi est annulée.</p>',
};
