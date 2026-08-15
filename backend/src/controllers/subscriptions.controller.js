import { prisma } from '../config/database.js';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import contractService from '../services/contract.service.js';
import { z } from 'zod';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  HttpForbiddenError,
  httpStatusCodes
} from '../utils/httpErrors.js';
import { logAudit } from '../services/audit.service.js';
import { createSubscriptionWithNumber } from '../services/subscriptionNumber.service.js';
import { computeRemainingPickups } from '../utils/subscriptionSchedule.js';
import {
  computeSubscriptionPrice,
  getPricingGrid,
  splitPayment,
  computeDueDates,
  PAYMENT_TYPES
} from '../utils/subscriptionPricing.js';

const SubscriptionTypeSchema = z.enum(['ANNUAL', 'DISCOVERY']);
const BasketSizeSchema = z.enum(['SMALL', 'LARGE']);
const PricingTypeSchema = z.enum(['NORMAL', 'SOLIDARITY']);
const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);
const DateSchema = z.preprocess(emptyToUndefined, z.coerce.date());
const OptionalDateSchema = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const OptionalAmountSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().finite().min(0).optional()
);

const CreateSubscriptionSchema = z.object({
  userId: z.string().min(1, 'Utilisateur requis'),
  type: SubscriptionTypeSchema,
  basketSize: BasketSizeSchema,
  pricingType: PricingTypeSchema.optional().default('NORMAL'),
  startDate: DateSchema,
  endDate: DateSchema,
  pickupLocationId: z.string().min(1, 'Point de retrait requis')
}).refine(({ startDate, endDate }) => endDate > startDate, {
  message: 'La date de fin doit être postérieure à la date de début',
  path: ['endDate']
});

/* paidAmount n'est plus modifiable de l'extérieur. Il est devenu le reflet des
   lignes de paiement — la somme des chèques que l'association détient — et deux
   façons d'écrire le même argent finissent toujours par se contredire. Il se
   recalcule là où les chèques bougent, et nulle part ailleurs. */
const UpdateSubscriptionSchema = z.object({
  basketSize: BasketSizeSchema.optional(),
  pricingType: PricingTypeSchema.optional(),
  endDate: OptionalDateSchema,
  price: OptionalAmountSchema
});

/* Remise des chèques. Le nombre suffit : les montants se déduisent du prix et
   les échéances du calendrier de saison. Les numéros sont facultatifs — on ne
   saisit pas sept chiffres debout devant une file d'attente. */
const RecordChequesSchema = z.object({
  paymentType: z.enum(PAYMENT_TYPES, { message: 'Modalité de règlement invalide' }),
  receivedAt: OptionalDateSchema,
  checkNumbers: z.array(z.string().trim().max(20)).optional()
});

const PaymentStatusSchema = z.enum(['RECEIVED', 'DEPOSITED', 'SUCCEEDED', 'FAILED', 'RETURNED']);

const UpdatePaymentSchema = z.object({
  status: PaymentStatusSchema.optional(),
  checkNumber: z.string().trim().max(20).nullable().optional(),
  dueDate: OptionalDateSchema,
  password: z.string().optional()
});

/* Ce que l'association détient réellement : le chèque est dans la pochette, à la
   banque, ou crédité. Un chèque rejeté ou rendu à l'adhérent ne couvre plus
   rien, et le contrat redevient dû d'autant. */
const HELD_STATUSES = ['RECEIVED', 'DEPOSITED', 'SUCCEEDED'];

/* paidAmount est un reflet, jamais une saisie : il se relit depuis les chèques à
   chaque fois qu'un seul d'entre eux bouge, dans la même transaction. Deux
   écritures indépendantes du même argent finiraient par se contredire, et c'est
   le tableau de bord qui mentirait en premier. */
const recomputePaidAmount = async (tx, subscriptionId) => {
  const { _sum } = await tx.payment.aggregate({
    where: { subscriptionId, status: { in: HELD_STATUSES } },
    _sum: { amount: true }
  });

  const held = Number((_sum.amount ?? 0).toFixed(2));
  await tx.subscription.update({ where: { id: subscriptionId }, data: { paidAmount: held } });

  return held;
};

/* Le chèque avance sans cérémonie : de la pochette du trésorier à la banque, de
   la banque au compte. Ces deux pas-là suivent le trajet du papier, on les fait
   soixante fois dans une soirée, ils ne demandent rien.

   Tout le reste — revenir en arrière, constater un rejet, rendre les chèques —
   retire de l'argent au contrat ou efface un fait déjà consigné. Ceux-là
   demandent le mot de passe. */
const FORWARD_STEP = { RECEIVED: 'DEPOSITED', DEPOSITED: 'SUCCEEDED' };

const requiresReauth = (from, to) => FORWARD_STEP[from] !== to;

/* Les dates suivent le statut plutôt que de traîner derrière lui : un chèque
   ramené « en main » n'a plus été déposé, et un chèque rejeté l'a bien été. */
const stampsFor = (status, payment, now) => ({
  RECEIVED: { depositedAt: null, paidAt: null },
  DEPOSITED: { depositedAt: payment.depositedAt ?? now, paidAt: null },
  SUCCEEDED: { depositedAt: payment.depositedAt ?? now, paidAt: payment.paidAt ?? now },
  FAILED: { paidAt: null },
  RETURNED: { depositedAt: null, paidAt: null }
}[status]);

// GRILLE TARIFAIRE (PUBLIC)
// Le formulaire d'abonnement affichait sa propre copie des prix, qui a fini par
// diverger de celle du serveur. Il la lit désormais ici : une seule table décide
// à la fois de ce qu'on annonce et de ce qui est facturé.
const getPricing = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: { pricing: getPricingGrid() }
  });
});

// RÉCUPÉRER TOUTES LES DEMANDES D'ABONNEMENT (ADMIN)
const getSubscriptionRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);

  const skip = (parsedPage - 1) * parsedLimit;

  let where = {};

  if (status) {
    where.status = status;
  }

  const [requests, total] = await Promise.all([
    prisma.subscriptionRequest.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.subscriptionRequest.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      requests,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    }
  });
});

// RÉCUPÉRER TOUS LES ABONNEMENTS (ADMIN)
const getAllSubscriptions = asyncHandler(async (req, res) => {
  const { status, type, pricingType, search, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);

  const skip = (parsedPage - 1) * parsedLimit;

  let where = {};

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  if (pricingType) {
    where.pricingType = pricingType;
  }

  /* Recherche sur le numéro de contrat et sur l'identité de l'adhérent. Elle
     doit passer par la base : la liste est paginée, filtrer les seuls contrats
     déjà chargés ne verrait que la page en cours. */
  const trimmedSearch = typeof search === 'string' ? search.trim() : '';

  if (trimmedSearch) {
    where.OR = [
      { subscriptionNumber: { contains: trimmedSearch, mode: 'insensitive' } },
      { user: { firstName: { contains: trimmedSearch, mode: 'insensitive' } } },
      { user: { lastName: { contains: trimmedSearch, mode: 'insensitive' } } },
      { user: { email: { contains: trimmedSearch, mode: 'insensitive' } } }
    ];
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip,
      take: parsedLimit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        pickupLocation: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true
          }
        },
        _count: {
          select: {
            pickups: true
          }
        },
        pauses: {
          select: { startDate: true, endDate: true },
          orderBy: { endDate: 'desc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.subscription.count({ where })
  ]);

  /* La reprise des pauses expirées se faisait ici, sur les seuls abonnements que
     la page venait de charger. Elle appartient au job quotidien
     (jobs/pauseResume.job.js), qui voit toute la base et journalise la
     transition : consulter une liste ne change pas l'état des contrats. */

  const subscriptionsWithRemaining = subscriptions.map(sub => ({
    ...sub,
    pickupsRemaining: computeRemainingPickups({
      startDate: sub.startDate,
      endDate: sub.endDate,
      pickupsDone: sub._count.pickups
    })
  }));

  res.json({
    success: true,
    data: {
      subscriptions: subscriptionsWithRemaining,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    }
  });
});

// RÉCUPÉRER UN ABONNEMENT (ADMIN)
const getSubscriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          /* Permanences tenues par l'adhérent : la fiche de contrat les
             affiche, or elles pendent à l'utilisateur et non au contrat. */
          _count: { select: { shiftVolunteers: true } }
        }
      },
      pickupLocation: true,
      pickups: {
        include: {
          weeklyBasket: {
            select: {
              weekNumber: true,
              year: true,
              distributionDate: true
            }
          }
        },
        orderBy: {
          pickupDate: 'desc'
        },
        take: 10
      },
      pauses: {
        orderBy: {
          startDate: 'desc'
        }
      },
      /* Par échéance croissante : les chèques d'une même remise partagent leur
         date de création à la milliseconde près, un tri par createdAt les
         sortirait dans un ordre arbitraire. C'est l'ordre de dépôt qui compte,
         c'est celui dans lequel le trésorier les lit. */
      payments: {
        orderBy: {
          dueDate: 'asc'
        }
      }
    }
  });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  /* `pickups` est tronqué aux dix derniers pour l'affichage : le décompte des
     retraits effectués se lit sur la table, pas sur la longueur du tableau. */
  const pickupsDone = await prisma.weeklyPickup.count({
    where: { subscriptionId: id }
  });

  res.json({
    success: true,
    data: {
      ...subscription,
      pickupsDone,
      pickupsRemaining: computeRemainingPickups({
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        pickupsDone
      })
    }
  });
});

// CRÉER UN ABONNEMENT (ADMIN - après validation demande)
const createSubscription = asyncHandler(async (req, res) => {
  const parsed = CreateSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpBadRequestError(parsed.error.errors[0].message);

  const { userId, type, basketSize, pricingType, startDate, endDate, pickupLocationId } = parsed.data;

  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new HttpNotFoundError('Utilisateur introuvable');
  }

  // Vérifier que le point de retrait existe
  const pickupLocation = await prisma.pickupLocation.findUnique({
    where: { id: pickupLocationId }
  });

  if (!pickupLocation) {
    throw new HttpNotFoundError('Point de retrait introuvable');
  }

  // Le numéro d'abonnement est attribué par le service, au moment de l'insertion.
  const subscription = await createSubscriptionWithNumber({
    data: {
      userId,
      type,
      basketSize,
      pricingType: pricingType || 'NORMAL',
      status: 'ACTIVE',
      startDate,
      endDate,
      price: computeSubscriptionPrice({ type, basketSize, pricingType }),
      paidAmount: 0,
      pickupLocationId
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      },
      pickupLocation: true
    }
  });

  // Envoyer email de confirmation à l'adhérent
  await emailService.sendSubscriptionConfirmation(subscription, user);

  await logAudit(req, 'CREATE_SUBSCRIPTION', 'IMPORTANT', {
    type: 'SUBSCRIPTION',
    id: subscription.id,
    label: subscription.subscriptionNumber
  }, {
    price: subscription.price,
    pricingType: subscription.pricingType,
    startDate: subscription.startDate,
    endDate: subscription.endDate
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Abonnement créé avec succès',
    data: subscription
  });
});

// MODIFIER UN ABONNEMENT (ADMIN)
const updateSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  const parsed = UpdateSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpBadRequestError(parsed.error.errors[0].message);

  const { basketSize, pricingType, endDate, price } = parsed.data;

  if (endDate && endDate <= subscription.startDate) {
    throw new HttpBadRequestError('La date de fin doit être postérieure à la date de début');
  }

  /* Le prix se fige dès que les chèques sont là. Les montants inscrits sur les
     chèques découlent de lui, ils sont imprimés sur un contrat signé par les
     deux parties, et le papier est déjà dans la pochette du trésorier : le
     modifier ici laisserait en base un engagement que personne n'a signé. Pour
     changer le prix, il faut d'abord rendre les chèques. */
  if (price !== undefined && price !== subscription.price) {
    const chequesRemis = await prisma.payment.count({ where: { subscriptionId: id } });

    if (chequesRemis > 0) {
      throw new HttpConflictError(
        'Le prix ne peut plus être modifié : les chèques correspondants ont déjà été remis'
      );
    }
  }

  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      ...(basketSize && { basketSize }),
      ...(pricingType && { pricingType }),
      ...(endDate && { endDate }),
      ...(price !== undefined && { price })
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  await logAudit(req, 'UPDATE_SUBSCRIPTION', 'IMPORTANT', {
    type: 'SUBSCRIPTION',
    id,
    label: subscription.subscriptionNumber
  }, {
    before: {
      basketSize: subscription.basketSize,
      pricingType: subscription.pricingType,
      endDate: subscription.endDate,
      price: subscription.price,
      paidAmount: subscription.paidAmount
    },
    after: {
      basketSize: updated.basketSize,
      pricingType: updated.pricingType,
      endDate: updated.endDate,
      price: updated.price,
      paidAmount: updated.paidAmount
    }
  });

  res.json({
    success: true,
    message: 'Abonnement modifié avec succès',
    data: updated
  });
});

/* REMISE DES CHÈQUES (ADMIN) — c'est elle qui active l'abonnement.

   Elle remplace l'ancien bouton « Activer », qui basculait le statut sans que
   rien n'atteste d'un règlement : on pouvait avoir un abonnement actif, des
   paniers livrés chaque semaine, et pas un centime en face. Ici l'activation
   n'est plus un geste séparé, c'est la conséquence d'un fait — le trésorier
   tient les chèques.

   D'où le sens du statut PENDING, qui devient précis : contrat édité, chèques
   pas encore remis. Et d'où l'absence d'un état « en attente de réception » sur
   les paiements : une ligne n'existe que parce que le papier est là.

   Un seul geste pour toute la remise, et non un pointage chèque par chèque.
   L'adhérent tend une enveloppe, l'administrateur indique combien elle contient,
   le reste se déduit : les montants du prix, les échéances du calendrier de
   saison. Les numéros se saisissent après coup, pour ceux qui en ont le temps. */
const recordChequesReceived = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const parsed = RecordChequesSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpBadRequestError(parsed.error.errors[0].message);

  const { paymentType, receivedAt, checkNumbers = [] } = parsed.data;
  const remiseLe = receivedAt ?? new Date();

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: { payments: { select: { id: true } } }
  });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  /* Deux remises pour un même abonnement doubleraient l'engagement en base. La
     correction passe par la marche arrière, pas par une seconde saisie. */
  if (subscription.payments.length > 0) {
    throw new HttpConflictError('Les chèques de cet abonnement ont déjà été enregistrés');
  }

  if (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') {
    throw new HttpBadRequestError('Cet abonnement est clos : aucun règlement ne peut y être rattaché');
  }

  const amounts = splitPayment(subscription.price, paymentType);
  const dueDates = computeDueDates(subscription.startDate, paymentType);

  /* La somme des chèques vaut le prix par construction — le dernier est calculé
     par soustraction. On le vérifie tout de même avant d'écrire : c'est le seul
     endroit du projet où de l'argent entre en base, et une garantie qu'on ne
     contrôle jamais finit par ne plus en être une. */
  const total = Number(amounts.reduce((somme, montant) => somme + montant, 0).toFixed(2));

  if (total !== subscription.price) {
    throw new HttpBadRequestError(
      `Ventilation incohérente : ${total} € réparti pour un contrat de ${subscription.price} €`
    );
  }

  const { payments, updated } = await prisma.$transaction(async (tx) => {
    const payments = [];

    for (const [index, amount] of amounts.entries()) {
      payments.push(await tx.payment.create({
        data: {
          subscriptionId: id,
          amount,
          status: 'RECEIVED',
          receivedAt: remiseLe,
          dueDate: dueDates[index],
          checkNumber: checkNumbers[index]?.trim() || null
        }
      }));
    }

    /* paidAmount reflète ce que l'association détient, pas ce qu'elle a encaissé :
       l'engagement est couvert dès que le papier est là. Il se relit depuis les
       chèques, ici comme partout ailleurs.

       Le statut ne passe à ACTIVE que depuis PENDING : enregistrer les chèques
       d'un abonnement en pause ne doit pas le réveiller. */
    await recomputePaidAmount(tx, id);

    const updated = subscription.status === 'PENDING'
      ? await tx.subscription.update({ where: { id }, data: { status: 'ACTIVE' } })
      : await tx.subscription.findUnique({ where: { id } });

    return { payments, updated };
  });

  await logAudit(req, 'RECORD_CHEQUES_RECEIVED', 'CRITICAL', {
    type: 'SUBSCRIPTION',
    id,
    label: subscription.subscriptionNumber
  }, {
    paymentType,
    receivedAt: remiseLe,
    amounts,
    dueDates,
    numbered: checkNumbers.filter(Boolean).length,
    before: { status: subscription.status, paidAmount: subscription.paidAmount },
    after: { status: updated.status, paidAmount: updated.paidAmount }
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: `${payments.length} chèque${payments.length > 1 ? 's' : ''} enregistré${payments.length > 1 ? 's' : ''}`,
    data: { subscription: updated, payments }
  });
});

/* DÉPLACER UN CHÈQUE (ADMIN)

   Suit le papier plutôt qu'un état abstrait : il quitte la pochette du trésorier
   pour la banque, la banque pour le compte. Ces deux pas se font sans cérémonie,
   parce qu'on les répète et qu'ils ne retirent rien à personne.

   La marche arrière, elle, demande le mot de passe. Non pour savoir qui agit —
   la session le dit déjà et le journal l'écrit — mais pour établir que la
   personne devant le clavier est bien celle de la session, et non quelqu'un qui
   a ramassé la tablette restée déverrouillée sur la table d'une permanence.
   Cette garantie ne vaut que si chaque bénévole a son propre compte : derrière
   un compte partagé, le mot de passe ne prouve rien sur l'identité.

   Les échecs sont journalisés autant que les réussites. Une invite de mot de
   passe est un oracle, et un oracle que personne ne compte devient un moyen
   d'essayer le mot de passe de l'administrateur sans que rien ne le signale. */
const updatePayment = asyncHandler(async (req, res) => {
  const { id, paymentId } = req.params;

  const parsed = UpdatePaymentSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpBadRequestError(parsed.error.errors[0].message);

  const { status, checkNumber, dueDate, password } = parsed.data;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { subscription: { select: { id: true, subscriptionNumber: true } } }
  });

  if (!payment || payment.subscriptionId !== id) {
    throw new HttpNotFoundError('Chèque introuvable pour ce contrat');
  }

  const cible = { type: 'SUBSCRIPTION', id, label: payment.subscription.subscriptionNumber };
  const changeDeStatut = status !== undefined && status !== payment.status;
  const marcheArriere = changeDeStatut && requiresReauth(payment.status, status);

  if (marcheArriere) {
    /* req.user est un extrait choisi par le middleware, sans l'empreinte du mot
       de passe : on la relit ici, et seulement pour cette comparaison. */
    const compte = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true }
    });

    const valide = typeof password === 'string'
      && password.length > 0
      && compte
      && await bcrypt.compare(password, compte.password);

    if (!valide) {
      await logAudit(req, 'FAILED_PAYMENT_REAUTH', 'CRITICAL', cible, {
        paymentId,
        from: payment.status,
        to: status,
        motif: password ? 'mot de passe incorrect' : 'mot de passe absent'
      });

      /* 403 et non 401, bien qu'il s'agisse d'un mot de passe. La session est
         valide — c'est le contrôle d'élévation qui échoue. Le client traite tout
         401 sur route authentifiée comme une session expirée et renvoie à la
         page de connexion : une faute de frappe déconnecterait le trésorier en
         pleine permanence, la file d'attente devant lui. */
      throw new HttpForbiddenError(
        'Mot de passe incorrect : cette correction n\'a pas été enregistrée'
      );
    }
  }

  const now = new Date();

  const { updated, held } = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        ...(changeDeStatut && { status, ...stampsFor(status, payment, now) }),
        ...(checkNumber !== undefined && { checkNumber: checkNumber || null }),
        ...(dueDate !== undefined && { dueDate })
      }
    });

    const held = await recomputePaidAmount(tx, id);

    return { updated, held };
  });

  await logAudit(req, 'UPDATE_PAYMENT_STATUS', marcheArriere ? 'CRITICAL' : 'IMPORTANT', cible, {
    paymentId,
    montant: payment.amount,
    marcheArriere,
    before: { status: payment.status, dueDate: payment.dueDate, checkNumber: payment.checkNumber },
    after: { status: updated.status, dueDate: updated.dueDate, checkNumber: updated.checkNumber },
    paidAmount: held
  });

  res.json({
    success: true,
    message: marcheArriere ? 'Correction enregistrée' : 'Chèque mis à jour',
    data: { payment: updated, paidAmount: held }
  });
});

/* VUE TRÉSORERIE (ADMIN)

   La fiche d'abonnement montre les chèques d'un adhérent ; cette vue-ci montre
   tous les chèques de l'association, du plus proche au plus lointain. Ce sont
   deux questions différentes : « où en est le contrat de Claire » d'un côté,
   « qu'est-ce que je porte à la banque lundi » de l'autre.

   Même matière que le récapitulatif envoyé au trésorier par chequeReminder.job,
   à ceci près que l'email pousse les échéances imminentes tandis que l'écran
   laisse tout consulter. Le regroupement par mois est fait côté navigateur :
   c'est de la présentation, la base n'a pas à la connaître.

   Pas de pagination. Une AMAP compte quelques dizaines d'adhérents et un à
   quatre chèques chacun ; le tout tient dans une réponse, et le trésorier a
   besoin de la vue d'ensemble, pas d'une page sur trois. */
const getTreasuryCheques = asyncHandler(async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: {
      subscription: {
        select: {
          id: true,
          subscriptionNumber: true,
          status: true,
          user: { select: { firstName: true, lastName: true, email: true } }
        }
      }
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  });

  const debutDuJour = new Date();
  debutDuJour.setHours(0, 0, 0, 0);

  /* Le total est calculé sur les lignes qu'on renvoie, et non par un groupBy
     séparé : deux requêtes, ce sont deux instants, et l'écran finirait par
     afficher un chiffre que sa propre liste contredit. */
  const summary = {};
  const compter = (cle, montant) => {
    const seau = summary[cle] ?? (summary[cle] = { count: 0, amount: 0 });
    seau.count += 1;
    seau.amount = Number((seau.amount + montant).toFixed(2));
  };

  const cheques = payments.map((payment) => {
    const enRetard = payment.status === 'RECEIVED' && payment.dueDate < debutDuJour;

    compter(payment.status, payment.amount);
    if (enRetard) compter('LATE', payment.amount);

    return {
      id: payment.id,
      subscriptionId: payment.subscriptionId,
      subscriptionNumber: payment.subscription.subscriptionNumber,
      subscriptionStatus: payment.subscription.status,
      member: `${payment.subscription.user.firstName} ${payment.subscription.user.lastName}`,
      email: payment.subscription.user.email,
      amount: payment.amount,
      status: payment.status,
      dueDate: payment.dueDate,
      receivedAt: payment.receivedAt,
      depositedAt: payment.depositedAt,
      paidAt: payment.paidAt,
      checkNumber: payment.checkNumber,
      enRetard
    };
  });

  res.json({ success: true, data: { cheques, summary } });
});

// ANNULER UN ABONNEMENT (ADMIN)
const cancelSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  if (subscription.status === 'CANCELLED') {
    throw new HttpConflictError('Cet abonnement est déjà annulé');
  }

  const cancelled = await prisma.subscription.update({
    where: { id },
    data: {
      status: 'CANCELLED'
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  await emailService.sendSubscriptionCancellation(cancelled, cancelled.user);

  await logAudit(req, 'CANCEL_SUBSCRIPTION', 'IMPORTANT', { type: 'SUBSCRIPTION', id, label: subscription.subscriptionNumber });

  res.json({
    success: true,
    message: 'Abonnement annulé avec succès',
    data: cancelled
  });
});

// METTRE EN PAUSE UN ABONNEMENT (ADMIN)
const pauseSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, reason } = req.body;

  if (!startDate || !endDate) {
    throw new HttpBadRequestError('Dates de début et fin de pause requises');
  }

  const pauseStartDate = new Date(startDate);
  const pauseEndDate = new Date(endDate);

  if (Number.isNaN(pauseStartDate.getTime()) || Number.isNaN(pauseEndDate.getTime())) {
    throw new HttpBadRequestError('Dates de pause invalides');
  }

  if (pauseEndDate <= pauseStartDate) {
    throw new HttpBadRequestError('La date de fin de pause doit être postérieure à la date de début');
  }

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  if (subscription.status !== 'ACTIVE') {
    throw new HttpBadRequestError('Seuls les abonnements actifs peuvent être mis en pause');
  }

  // Vérifier la limite de 2 semaines (14 jours) au total
  const existingPauses = await prisma.subscriptionPause.findMany({ where: { subscriptionId: id } });
  const daysUsed = existingPauses.reduce((sum, p) =>
    sum + Math.round((new Date(p.endDate) - new Date(p.startDate)) / 86400000), 0
  );
  const daysRequested = Math.round((pauseEndDate - pauseStartDate) / 86400000);
  if (daysUsed + daysRequested > 14) {
    throw new HttpBadRequestError(
      `Limite de 2 semaines de pause atteinte. Jours déjà utilisés : ${daysUsed}/14`
    );
  }

  // Créer la pause
  const pause = await prisma.subscriptionPause.create({
    data: {
      subscriptionId: id,
      startDate: pauseStartDate,
      endDate: pauseEndDate,
      reason
    }
  });

  // Mettre à jour le statut
  await prisma.subscription.update({
    where: { id },
    data: { status: 'PAUSED' }
  });

  /* Une pause suspend des livraisons dues et consomme un quota de quatorze jours
     par saison : c'est une modification du contrat, au même titre que
     l'activation et la résiliation qui, elles, étaient déjà journalisées. */
  await logAudit(req, 'PAUSE_SUBSCRIPTION', 'IMPORTANT', { type: 'SUBSCRIPTION', id, label: subscription.subscriptionNumber }, { startDate: pauseStartDate, endDate: pauseEndDate, reason: reason ?? null, daysUsedBefore: daysUsed, daysRequested });

  res.json({
    success: true,
    message: 'Abonnement mis en pause avec succès',
    data: pause
  });
});

// REPRENDRE UN ABONNEMENT (ADMIN)
const resumeSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscription = await prisma.subscription.findUnique({ where: { id } });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  if (subscription.status !== 'PAUSED') {
    throw new HttpBadRequestError('Seuls les abonnements en pause peuvent être repris');
  }

  const resumed = await prisma.subscription.update({
    where: { id },
    data: { status: 'ACTIVE' }
  });

  /* Reprise à la main, par opposition à celle du job quotidien, qui journalise de
     son côté sous UPDATE_SUBSCRIPTION_STATUS avec « système » pour auteur. Les
     deux se distinguent ainsi dans le journal : une reprise anticipée n'est pas
     une fin de pause. */
  await logAudit(req, 'RESUME_SUBSCRIPTION', 'IMPORTANT', { type: 'SUBSCRIPTION', id, label: subscription.subscriptionNumber });

  res.json({
    success: true,
    message: 'Abonnement réactivé avec succès',
    data: resumed
  });
});

// MON ABONNEMENT (ADHÉRENT)
const getMySubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'PAUSED'] }
    },
    include: {
      pickupLocation: true,
      pickups: {
        include: {
          weeklyBasket: {
            select: {
              weekNumber: true,
              year: true,
              distributionDate: true
            }
          }
        },
        orderBy: {
          pickupDate: 'desc'
        },
        take: 5
      },
      // Toutes les pauses de la saison, passées comprises : l'espace adhérent
      // affiche le solde de semaines restantes, qui serait faux si les pauses
      // déjà écoulées étaient filtrées.
      pauses: {
        orderBy: { startDate: 'asc' }
      },

      /* Les chèques de l'adhérent, dans l'ordre où ils partiront en banque.
         C'est lui qui les a écrits : il a le droit de savoir ce que
         l'association en a fait, et surtout quand le prochain sera encaissé.
         Sans cela son espace lui annonce « reste 888 € » alors qu'il a remis
         son enveloppe le mois dernier.

         Champs choisis un par un : rien de ce qui relève de la tenue interne
         des comptes n'a de raison de descendre jusqu'au navigateur. */
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          dueDate: true,
          depositedAt: true,
          paidAt: true,
          checkNumber: true
        },
        orderBy: { dueDate: 'asc' }
      }
    }
  });

  if (!subscription) {
    return res.json({
      success: true,
      message: 'Aucun abonnement actif',
      data: null
    });
  }

  res.json({
    success: true,
    data: subscription
  });
});

// STATISTIQUES ABONNEMENTS (ADMIN)
const getSubscriptionStats = asyncHandler(async (req, res) => {
  const [
    totalActive,
    totalPaused,
    totalCancelled,
    byType,
    bySize,
    solidarityCount,
    totalRevenue
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'PAUSED' } }),
    prisma.subscription.count({ where: { status: 'CANCELLED' } }),
    prisma.subscription.groupBy({
      by: ['type'],
      where: { status: 'ACTIVE' },
      _count: true
    }),
    prisma.subscription.groupBy({
      by: ['basketSize'],
      where: { status: 'ACTIVE' },
      _count: true
    }),
    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        pricingType: 'SOLIDARITY'
      }
    }),
    prisma.subscription.aggregate({
      where: { status: { in: ['ACTIVE', 'PAUSED'] } },
      _sum: { paidAmount: true }
    })
  ]);

  res.json({
    success: true,
    data: {
      active: totalActive,
      paused: totalPaused,
      cancelled: totalCancelled,
      byType,
      bySize,
      solidarity: solidarityCount,
      revenue: totalRevenue._sum.paidAmount || 0
    }
  });
});

// GÉNÉRER LE CONTRAT PDF D'UN ABONNEMENT (ADMIN, OU L'ADHÉRENT SUR LE SIEN)
const generateContractFromSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Récupérer l'abonnement avec les relations nécessaires
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true
        }
      },
      pickupLocation: true
    }
  });

  if (!subscription) {
    throw new HttpNotFoundError('Abonnement introuvable');
  }

  // Un adhérent ne peut télécharger que son propre contrat
  if (req.user.role !== 'ADMIN' && subscription.userId !== req.user.id) {
    throw new HttpForbiddenError('Accès refusé à ce contrat');
  }

  // 2. Retrouver la demande associée pour récupérer le paymentType
  const request = await prisma.subscriptionRequest.findFirst({
    where: {
      email: subscription.user.email,
      type: subscription.type,
      basketSize: subscription.basketSize,
      status: 'APPROVED'
    },
    orderBy: { createdAt: 'desc' }
  });

  const paymentType = request?.paymentType ?? '1';

  // 3. Générer le PDF
  const pdfBuffer = await contractService.generateContract(subscription, subscription.user, paymentType);

  // 4. Renvoyer le PDF en inline pour affichage dans le navigateur
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Contrat_${subscription.subscriptionNumber}_${subscription.user.lastName}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.setHeader('Cache-Control', 'no-cache');

  res.end(pdfBuffer, 'binary');
});

export {
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  recordChequesReceived,
  updatePayment,
  getTreasuryCheques,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getMySubscription,
  getPricing,
  getSubscriptionRequests,
  getSubscriptionStats,
  generateContractFromSubscription
};