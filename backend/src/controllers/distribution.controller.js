import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError
} from '../utils/httpErrors.js';
import { logAudit } from '../services/audit.service.js';

// REQUÊTE PARTAGÉE
async function fetchDistributionData(weeklyBasketId) {
  const weeklyBasket = await prisma.weeklyBasket.findUnique({
    where: { id: weeklyBasketId }
  });

  if (!weeklyBasket) throw new HttpNotFoundError('Panier hebdomadaire introuvable');

  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      startDate: { lte: weeklyBasket.distributionDate },
      endDate: { gte: weeklyBasket.distributionDate },
      user: { deletedAt: null }
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true
        }
      },
      pickups: {
        where: { weeklyBasketId },
        select: {
          id: true,
          wasPickedUp: true,
          pickedUpAt: true,
          pickedUpBy: true,
          notes: true
        }
      }
    },
    orderBy: { user: { lastName: 'asc' } }
  });

  return { weeklyBasket, activeSubscriptions };
}

/* LISTE D'ÉMARGEMENT

   Plus de filtre de recherche ici : l'écran d'émargement charge la liste une
   fois et filtre dans le navigateur, ce qui répond à la touche sans aller-retour
   réseau — précieux un mercredi soir, la file qui avance et le wifi de la salle
   qui faiblit.

   Le filtre serveur faussait de surcroît les compteurs plus bas, calculés sur la
   liste retournée : rechercher un adhérent faisait afficher « 1 abonné attendu,
   0 % de retrait » au tableau de bord. La réponse porte désormais toujours sur
   la semaine entière, et il n'y a plus qu'une seule vérité à lire. */
const getDistributionList = asyncHandler(async (req, res) => {
  const { weeklyBasketId } = req.params;

  const { weeklyBasket, activeSubscriptions } = await fetchDistributionData(weeklyBasketId);

  const distributionList = activeSubscriptions.map(sub => {
    const pickup = sub.pickups[0] || null;
    return {
      subscriptionId: sub.id,
      subscriptionNumber: sub.subscriptionNumber,
      basketSize: sub.basketSize,
      user: sub.user,
      pickup: pickup ? {
        id: pickup.id,
        wasPickedUp: pickup.wasPickedUp,
        pickedUpAt: pickup.pickedUpAt,
        pickedUpBy: pickup.pickedUpBy,
        notes: pickup.notes
      } : null
    };
  });

  res.json({
    success: true,
    data: {
      weeklyBasket,
      totalSubscribers: distributionList.length,
      pickedUp: distributionList.filter(d => d.pickup?.wasPickedUp).length,
      pending: distributionList.filter(d => !d.pickup?.wasPickedUp).length,
      list: distributionList
    }
  });
});

// MARQUER COMME RÉCUPÉRÉ
const markAsPickedUp = asyncHandler(async (req, res) => {
  const { pickupId } = req.params;
  const { wasPickedUp, notes, weeklyBasketId } = req.body;
  const pickedUpBy = `${req.user.firstName} ${req.user.lastName}`;

  if (typeof wasPickedUp !== 'boolean') {
    throw new HttpBadRequestError('wasPickedUp doit être un booléen');
  }

  // Chercher ou créer le pickup
  let pickup;
  let previousPickup = null;

  if (pickupId === 'new') {
    // Créer un nouveau pickup
    const { subscriptionId, weeklyBasketId } = req.body;

    if (!subscriptionId || !weeklyBasketId) {
      throw new HttpBadRequestError('subscriptionId et weeklyBasketId requis');
    }

    const weeklyBasket = await prisma.weeklyBasket.findUnique({
      where: { id: weeklyBasketId }
    });

    if (!weeklyBasket) {
      throw new HttpNotFoundError('Panier hebdomadaire introuvable');
    }

    pickup = await prisma.weeklyPickup.create({
      data: {
        subscriptionId,
        weeklyBasketId,
        pickupDate: weeklyBasket.distributionDate,
        wasPickedUp: wasPickedUp || false,
        pickedUpAt: wasPickedUp ? new Date() : null,
        pickedUpBy: wasPickedUp ? pickedUpBy : null,
        notes
      }
    });
  } else {
    // Mettre à jour un pickup existant
    if (!weeklyBasketId) {
      throw new HttpBadRequestError('weeklyBasketId requis');
    }

    pickup = await prisma.weeklyPickup.findUnique({
      where: { id: pickupId }
    });

    if (!pickup) {
      throw new HttpNotFoundError('Retrait introuvable');
    }

    if (pickup.weeklyBasketId !== weeklyBasketId) {
      throw new HttpNotFoundError('Retrait introuvable pour ce panier hebdomadaire');
    }

    previousPickup = pickup;

    /* L'heure et l'auteur suivent l'état du retrait, sans jamais le contredire :
       on efface les deux quand le panier est décoché, sinon l'export imprimerait
       « Non » dans « Retiré » avec une heure dans « Heure retrait ». Et on garde
       l'horodatage d'origine s'il existe déjà : ajouter une note à un panier
       déjà récupéré ne doit pas réécrire l'heure à laquelle il l'a été. */
    pickup = await prisma.weeklyPickup.update({
      where: { id: pickupId },
      data: {
        wasPickedUp,
        pickedUpAt: wasPickedUp ? (pickup.pickedUpAt ?? new Date()) : null,
        pickedUpBy: wasPickedUp ? (pickup.pickedUpBy ?? pickedUpBy) : null,
        notes
      }
    });
  }

  await logAudit(req, 'UPDATE_WEEKLY_PICKUP', 'IMPORTANT', {
    type: 'WEEKLY_PICKUP',
    id: pickup.id,
    label: pickup.weeklyBasketId
  }, {
    subscriptionId: pickup.subscriptionId,
    before: previousPickup ? { wasPickedUp: previousPickup.wasPickedUp } : null,
    after: { wasPickedUp: pickup.wasPickedUp }
  });

  res.json({
    success: true,
    message: wasPickedUp ? 'Retrait validé' : 'Retrait annulé',
    data: pickup
  });
});

// STATISTIQUES DISTRIBUTION
const getDistributionStats = asyncHandler(async (req, res) => {
  const { weeklyBasketId } = req.params;

  const weeklyBasket = await prisma.weeklyBasket.findUnique({
    where: { id: weeklyBasketId }
  });

  if (!weeklyBasket) {
    throw new HttpNotFoundError('Panier hebdomadaire introuvable');
  }

  const [totalExpected, totalPickedUp] = await Promise.all([
    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        startDate: { lte: weeklyBasket.distributionDate },
        endDate: { gte: weeklyBasket.distributionDate }
      }
    }),
    prisma.weeklyPickup.count({
      where: {
        weeklyBasketId,
        wasPickedUp: true
      }
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalExpected,
      totalPickedUp,
      totalPending: totalExpected - totalPickedUp,
      percentagePickedUp: totalExpected > 0 ? Math.round((totalPickedUp / totalExpected) * 100) : 0
    }
  });
});

// EXPORT LISTE (CSV)
const exportDistributionList = asyncHandler(async (req, res) => {
  const { weeklyBasketId } = req.params;

  const { weeklyBasket, activeSubscriptions } = await fetchDistributionData(weeklyBasketId);

  await logAudit(req, 'EXPORT_DISTRIBUTION_LIST', 'IMPORTANT', {
    type: 'WEEKLY_BASKET',
    id: weeklyBasketId,
    label: weeklyBasket.distributionDate.toISOString()
  }, { subscribersCount: activeSubscriptions.length });

  /* Un tableur ne lit pas une cellule, il l'évalue : tout ce qui commence par
     =, +, - ou @ est traité comme une formule, y compris entre guillemets CSV.
     Le numéro au format international +33612345678 — que la validation autorise
     explicitement — ressort donc en #NOM? dans la colonne téléphone, le jour où
     le bénévole imprime sa liste pour joindre un adhérent absent.

     L'apostrophe initiale est le garde-fou standard : Excel et LibreOffice la
     lisent comme « ceci est du texte » et ne l'affichent pas. Elle reste en
     revanche visible pour un programme qui relirait le fichier, ce qui est le
     bon compromis pour un export destiné à être ouvert et imprimé. */
  const escape = (val) => {
    const raw = String(val ?? '');
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

    return `"${safe.replace(/"/g, '""')}"`;
  };

  const header = ['N° abonnement', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Panier', 'Récupéré', 'Heure de récupération', 'Notes'];

  const rows = activeSubscriptions.map(sub => {
    const pickup = sub.pickups[0] || null;
    const basket = sub.basketSize === 'SMALL' ? 'Petit' : 'Grand';
    const pickedUp = pickup?.wasPickedUp ? 'Oui' : 'Non';
    const pickedUpAt = pickup?.pickedUpAt ? new Date(pickup.pickedUpAt).toLocaleString('fr-FR') : '';
    return [
      sub.subscriptionNumber,
      sub.user.lastName,
      sub.user.firstName,
      sub.user.email,
      sub.user.phone || '',
      basket,
      pickedUp,
      pickedUpAt,
      pickup?.notes || ''
    ].map(escape).join(',');
  });

  const csv = [header.map(escape).join(','), ...rows].join('\r\n');
  const filename = `distribution_${weeklyBasket.distributionDate.toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv);
});

export {
  getDistributionList,
  markAsPickedUp,
  getDistributionStats,
  exportDistributionList
};
