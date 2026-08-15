import { prisma } from '../config/database.js';

/* NUMÉRO DE CONTRAT

   Le numéro se lisait « combien de contrats existent, plus un ». Deux défauts
   se cachent dans cette phrase.

   Le premier est une course. Entre le comptage et l'insertion, rien n'empêche
   une seconde approbation de compter la même chose et de proposer le même
   numéro. La contrainte @unique de la base rattrape le doublon — aucun n'a
   jamais atteint la table —, mais le bénévole qui approuvait deux demandes coup
   sur coup voyait la seconde échouer sur un « erreur en base » anonyme, sans
   rien qui lui dise qu'il suffisait de recommencer.

   Le second est plus sournois : compter, ce n'est pas se souvenir. Qu'une purge
   RGPD retire un contrat de l'année et le compte redescend ; le numéro suivant
   reprend alors une valeur déjà imprimée sur un contrat papier, et l'unicité en
   base n'y voit rien puisque l'ancienne ligne a disparu. Deux contrats
   différents portant SUB-2026-014 dans les archives de l'association, à deux ans
   d'écart.

   On dérive donc du plus grand numéro attribué, pas de leur nombre, et l'on
   retente lorsque deux créations se croisent. */

const PREFIX = (year) => `SUB-${year}-`;

/* Cinq essais : chaque échec signifie qu'un autre contrat vient de prendre le
   numéro visé, donc que le suivant est libre. Au-delà, ce n'est plus une course
   mais une panne, et il vaut mieux la laisser remonter que boucler. */
const MAX_ATTEMPTS = 5;

/* Le plus grand numéro de l'année, comparé sur sa valeur et non sur son
   écriture. Laisser la base trier par ordre alphabétique serait plus court,
   mais « SUB-2026-1000 » y passerait avant « SUB-2026-999 » : le jour où
   l'association dépasse mille contrats dans l'année, le compteur repartirait en
   arrière. On relit donc les numéros de l'année — une centaine de chaînes — et
   l'on prend le maximum arithmétique. */
const nextNumber = async (tx) => {
  const prefix = PREFIX(new Date().getFullYear());

  const existing = await tx.subscription.findMany({
    where: { subscriptionNumber: { startsWith: prefix } },
    select: { subscriptionNumber: true }
  });

  const highest = existing.reduce((max, { subscriptionNumber }) => {
    const value = Number.parseInt(subscriptionNumber.slice(prefix.length), 10);

    return Number.isNaN(value) ? max : Math.max(max, value);
  }, 0);

  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
};

/* Un P2002 ne dit pas « doublon » tout court, il nomme la colonne fautive. Deux
   contrats peuvent se marcher dessus sur le numéro, mais une autre contrainte
   d'unicité qui sauterait serait un vrai défaut : la retenter en boucle
   reviendrait à cacher le problème au lieu de le remonter. */
const isNumberCollision = (error) => (
  error?.code === 'P2002' && [].concat(error.meta?.target ?? []).includes('subscriptionNumber')
);

/* Création d'un contrat, numéro compris — le seul endroit du projet qui attribue
   un numéro d'abonnement. Les deux chemins de création, l'admin qui saisit un
   contrat à la main et l'approbation d'une demande, passent par ici.

   La lecture du maximum et l'insertion tiennent dans une même transaction, mais
   ce n'est pas elle qui règle la course : PostgreSQL travaille en READ COMMITTED,
   deux transactions concurrentes lisent donc le même maximum sans se voir. Ce qui
   sérialise réellement, c'est la contrainte d'unicité — l'une des deux insertions
   est refusée — et le nouvel essai qui suit, lequel relit un maximum entre-temps
   augmenté et prend le numéro d'après. La transaction sert l'atomicité de
   l'ensemble, le rattrapage sert la concurrence. */
export const createSubscriptionWithNumber = async ({ data, include }) => {
  let lastError;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const subscriptionNumber = await nextNumber(tx);

        return tx.subscription.create({
          data: { ...data, subscriptionNumber },
          include
        });
      });
    } catch (error) {
      if (!isNumberCollision(error)) throw error;

      lastError = error;
    }
  }

  throw lastError;
};
