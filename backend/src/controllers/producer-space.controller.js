import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpBadRequestError, HttpConflictError, HttpNotFoundError, httpStatusCodes } from '../utils/httpErrors.js';
import { logAudit } from '../services/audit.service.js';
import { validateAbsencePeriod, absenceSelect, describeAbsence } from '../services/producerAbsence.service.js';
import {
  OwnFarmSchema,
  OwnProductSchema,
  UpdateOwnProductSchema,
  OwnAbsenceSchema,
  UpdateProducerAbsenceSchema,
} from '../utils/validation.schemas.js';

/* Espace producteur, derrière producerOnly. La ferme vient toujours de
   req.producerId, posé depuis le compte : jamais du corps ni de l'URL. */

const refuserPortee = (req, cible, motif, extra = {}) =>
  logAudit(req, 'FAILED_PRODUCER_SCOPE_CHECK', 'CRITICAL', cible, {
    motif,
    method: req.method,
    path: req.originalUrl?.split('?')[0],
    ...extra,
  }, motif);

// Une clé hors du schéma est refusée, jamais ignorée : le front de l'espace ne l'envoie pas.
async function lireCorps(req, schema, cible) {
  const corps = req.body ?? {};
  if (typeof corps !== 'object' || Array.isArray(corps)) {
    throw new HttpBadRequestError('Requête invalide');
  }

  const interdits = Object.keys(corps).filter((cle) => !Object.hasOwn(schema.shape, cle));
  if (interdits.length) {
    await refuserPortee(req, cible, 'CHAMP_INTERDIT', {
      champs: interdits.slice(0, 20).map((cle) => cle.slice(0, 64)),
    });
    throw new HttpBadRequestError('Requête refusée : champ non modifiable.');
  }

  const parsed = schema.safeParse(corps);
  if (!parsed.success) throw new HttpBadRequestError(parsed.error.issues[0].message);
  return parsed.data;
}

const videEnNull = (data) =>
  Object.fromEntries(Object.entries(data).map(([cle, valeur]) => [cle, valeur === '' ? null : valeur]));

const capitaliser = (nom) => nom.charAt(0).toUpperCase() + nom.slice(1);

// FICHE

const ficheSelect = {
  id: true,
  name: true,
  description: true,
  specialty: true,
  image: true,
  phone: true,
  city: true,
  postalCode: true,
  distanceKm: true,
  certification: true,
  farmDetailLabel: true,
  farmDetail: true,
  partnerSince: true,
  isActive: true,
};

export const getOwnFarm = asyncHandler(async (req, res) => {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId }, select: ficheSelect });
  if (!producer) throw new HttpNotFoundError('Fiche introuvable');

  res.json({ success: true, data: { producer } });
});

export const updateOwnFarm = asyncHandler(async (req, res) => {
  const data = videEnNull(await lireCorps(req, OwnFarmSchema, { type: 'PRODUCER', id: req.producerId }));

  const producer = await prisma.producer.update({
    where: { id: req.producerId },
    data,
    select: ficheSelect,
  });

  await logAudit(req, 'UPDATE_PRODUCER', 'IMPORTANT', {
    type: 'PRODUCER',
    id: producer.id,
    label: producer.name,
  }, { champs: Object.keys(data) });

  res.json({ success: true, message: 'Fiche mise à jour', data: { producer } });
});

// PRODUITS

const produitSelect = {
  id: true,
  name: true,
  category: true,
  description: true,
  isActive: true,
  seasons: true,
  basketSizes: true,
  deletionRequestedAt: true,
  createdAt: true,
  updatedAt: true,
};

/* Modification, demande et annulation de suppression passent sous le verrou de
   la ligne : la ferme et la demande en cours sont relues avant d'écrire. */
async function ecrireProduit(req, id, travail) {
  const issue = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${id} FOR UPDATE`;

    const avant = await tx.product.findUnique({
      where: { id },
      select: { ...produitSelect, producerId: true, deletedAt: true },
    });
    if (!avant) return { introuvable: true };
    if (avant.producerId !== req.producerId) return { autreFerme: true };
    if (avant.deletedAt) return { introuvable: true };

    return travail(tx, avant);
  });

  if (issue.autreFerme) await refuserPortee(req, { type: 'PRODUCT', id }, 'PRODUIT_AUTRE_FERME');
  if (issue.introuvable || issue.autreFerme) throw new HttpNotFoundError('Produit introuvable');
  if (issue.conflit) throw new HttpConflictError(issue.conflit);
  return issue;
}

export const getOwnProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { producerId: req.producerId, deletedAt: null },
    select: produitSelect,
    orderBy: { name: 'asc' },
  });

  res.json({ success: true, data: { products, count: products.length } });
});

export const createOwnProduct = asyncHandler(async (req, res) => {
  const data = await lireCorps(req, OwnProductSchema, { type: 'PRODUCER', id: req.producerId });
  const name = capitaliser(data.name);

  const existing = await prisma.product.findFirst({
    where: { name, producerId: req.producerId },
    select: { id: true },
  });
  if (existing) throw new HttpBadRequestError(`"${name}" existe déjà dans votre catalogue`);

  const product = await prisma.product.create({
    data: {
      name,
      producerId: req.producerId,
      category: data.category ?? null,
      description: data.description || null,
      isActive: data.isActive ?? true,
      seasons: data.seasons,
      basketSizes: data.basketSizes,
    },
    select: produitSelect,
  });

  await logAudit(req, 'CREATE_PRODUCT', 'IMPORTANT', { type: 'PRODUCT', id: product.id, label: product.name });

  res.status(httpStatusCodes.CREATED).json({ success: true, message: 'Produit créé', data: { product } });
});

export const updateOwnProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = videEnNull(await lireCorps(req, UpdateOwnProductSchema, { type: 'PRODUCT', id }));
  if (data.name !== undefined) data.name = capitaliser(data.name);

  const { avant, product } = await ecrireProduit(req, id, async (tx, avant) => {
    if (data.isActive === true && avant.deletionRequestedAt) {
      return { conflit: 'Suppression demandée : annulez la demande avant de réactiver ce produit.' };
    }
    const product = await tx.product.update({ where: { id }, data, select: produitSelect });
    return { avant, product };
  });

  await logAudit(req, 'UPDATE_PRODUCT', 'IMPORTANT', { type: 'PRODUCT', id, label: avant.name }, {
    before: { name: avant.name, isActive: avant.isActive },
    after: { name: product.name, isActive: product.isActive },
  });

  res.json({ success: true, message: 'Produit modifié', data: { product } });
});

// Le produit sort du tirage dans la même écriture ; l'admin supprime ou refuse.
export const requestProductDeletion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { avant, product } = await ecrireProduit(req, id, async (tx, avant) => {
    if (avant.deletionRequestedAt) return { conflit: 'La suppression de ce produit est déjà demandée.' };
    const product = await tx.product.update({
      where: { id },
      data: { deletionRequestedAt: new Date(), isActive: false },
      select: produitSelect,
    });
    return { avant, product };
  });

  await logAudit(req, 'REQUEST_PRODUCT_DELETION', 'IMPORTANT', { type: 'PRODUCT', id, label: avant.name }, {
    wasActive: avant.isActive,
  });

  res.json({ success: true, message: 'Suppression demandée', data: { product } });
});

// Annuler ne réactive pas le produit.
export const cancelProductDeletion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { avant, product } = await ecrireProduit(req, id, async (tx, avant) => {
    if (!avant.deletionRequestedAt) return { conflit: 'Aucune demande de suppression en cours pour ce produit.' };
    const product = await tx.product.update({
      where: { id },
      data: { deletionRequestedAt: null },
      select: produitSelect,
    });
    return { avant, product };
  });

  await logAudit(req, 'UPDATE_PRODUCT', 'IMPORTANT', { type: 'PRODUCT', id, label: avant.name }, {
    geste: 'ANNULATION_DEMANDE_SUPPRESSION',
  });

  res.json({ success: true, message: 'Demande de suppression annulée', data: { product } });
});

// ABSENCES — journalisées en UPDATE_PRODUCER, comme côté admin.

async function absenceDeLaFerme(req, id) {
  const absence = await prisma.producerAbsence.findUnique({ where: { id }, select: absenceSelect });

  if (absence && absence.producerId !== req.producerId) {
    await refuserPortee(req, { type: 'PRODUCER_ABSENCE', id }, 'ABSENCE_AUTRE_FERME');
  }
  if (!absence || absence.producerId !== req.producerId) throw new HttpNotFoundError('Absence introuvable');
  return absence;
}

export const getOwnAbsences = asyncHandler(async (req, res) => {
  const absences = await prisma.producerAbsence.findMany({
    where: { producerId: req.producerId },
    select: absenceSelect,
    orderBy: { startDate: 'desc' },
  });

  res.json({ success: true, data: { absences, count: absences.length } });
});

export const createOwnAbsence = asyncHandler(async (req, res) => {
  const { startDate, endDate, reason } = await lireCorps(req, OwnAbsenceSchema, { type: 'PRODUCER', id: req.producerId });

  const periodError = validateAbsencePeriod(startDate, endDate);
  if (periodError) throw new HttpBadRequestError(periodError);

  const absence = await prisma.producerAbsence.create({
    data: {
      producerId: req.producerId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || null,
    },
    select: absenceSelect,
  });

  await logAudit(req, 'UPDATE_PRODUCER', 'IMPORTANT', {
    type: 'PRODUCER',
    id: req.producerId,
    label: `Absence déclarée : ${describeAbsence(absence)}`,
  });

  res.status(httpStatusCodes.CREATED).json({ success: true, data: { absence } });
});

export const updateOwnAbsence = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, reason } = await lireCorps(req, UpdateProducerAbsenceSchema, { type: 'PRODUCER_ABSENCE', id });
  const existing = await absenceDeLaFerme(req, id);

  const nextStart = startDate ?? existing.startDate;
  const nextEnd = endDate ?? existing.endDate;
  const periodError = validateAbsencePeriod(nextStart, nextEnd);
  if (periodError) throw new HttpBadRequestError(periodError);

  const absence = await prisma.producerAbsence.update({
    where: { id, producerId: req.producerId },
    data: {
      startDate: new Date(nextStart),
      endDate: new Date(nextEnd),
      ...(reason !== undefined && { reason: reason || null }),
    },
    select: absenceSelect,
  });

  await logAudit(req, 'UPDATE_PRODUCER', 'IMPORTANT', {
    type: 'PRODUCER',
    id: req.producerId,
    label: `Absence corrigée : ${describeAbsence(absence)}`,
  });

  res.json({ success: true, data: { absence } });
});

export const deleteOwnAbsence = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await absenceDeLaFerme(req, id);

  await prisma.producerAbsence.delete({ where: { id, producerId: req.producerId } });

  await logAudit(req, 'UPDATE_PRODUCER', 'IMPORTANT', {
    type: 'PRODUCER',
    id: req.producerId,
    label: `Absence annulée : ${describeAbsence(existing)}`,
  });

  res.json({ success: true, message: 'Absence annulée' });
});
