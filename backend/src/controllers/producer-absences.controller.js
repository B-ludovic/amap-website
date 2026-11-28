import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpNotFoundError, HttpBadRequestError } from '../utils/httpErrors.js';
import { validateAbsencePeriod, absenceSelect, describeAbsence } from '../services/producerAbsence.service.js';
import { logAudit } from '../services/audit.service.js';
import { ProducerAbsenceSchema, UpdateProducerAbsenceSchema } from '../utils/validation.schemas.js';

/* Les absences sont journalisées sous UPDATE_PRODUCER : déclarer qu'une ferme
   manque une distribution change ce que l'AMAP distribuera, et le registre doit
   pouvoir l'expliquer après coup. */
const AUDIT_ACTION = 'UPDATE_PRODUCER';

// LISTER LES ABSENCES, toutes ou celles d'une seule ferme
const getAllProducerAbsences = asyncHandler(async (req, res) => {
  const { producerId } = req.query;

  const absences = await prisma.producerAbsence.findMany({
    where: producerId ? { producerId } : undefined,
    select: absenceSelect,
    orderBy: { startDate: 'desc' }
  });

  res.json({ success: true, data: { absences, count: absences.length } });
});

// DÉCLARER UNE ABSENCE
const createProducerAbsence = asyncHandler(async (req, res) => {
  const parsed = ProducerAbsenceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpBadRequestError(parsed.error.issues[0].message);
  }
  const { producerId, startDate, endDate, reason } = parsed.data;

  const periodError = validateAbsencePeriod(startDate, endDate);
  if (periodError) throw new HttpBadRequestError(periodError);

  const producer = await prisma.producer.findUnique({ where: { id: producerId } });
  if (!producer) throw new HttpNotFoundError('Ferme introuvable');

  const absence = await prisma.producerAbsence.create({
    data: {
      producerId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || null
    },
    select: absenceSelect
  });

  await logAudit(req, AUDIT_ACTION, 'IMPORTANT', {
    type: 'PRODUCER',
    id: producerId,
    label: `Absence déclarée : ${describeAbsence(absence)}`
  });

  res.status(201).json({ success: true, data: { absence } });
});

// CORRIGER UNE ABSENCE
const updateProducerAbsence = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const parsed = UpdateProducerAbsenceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpBadRequestError(parsed.error.issues[0].message);
  }
  const { startDate, endDate, reason } = parsed.data;

  const existing = await prisma.producerAbsence.findUnique({ where: { id }, select: absenceSelect });
  if (!existing) throw new HttpNotFoundError('Absence introuvable');

  const nextStart = startDate ?? existing.startDate;
  const nextEnd = endDate ?? existing.endDate;

  const periodError = validateAbsencePeriod(nextStart, nextEnd);
  if (periodError) throw new HttpBadRequestError(periodError);

  const absence = await prisma.producerAbsence.update({
    where: { id },
    data: {
      startDate: new Date(nextStart),
      endDate: new Date(nextEnd),
      ...(reason !== undefined && { reason: reason || null })
    },
    select: absenceSelect
  });

  await logAudit(req, AUDIT_ACTION, 'IMPORTANT', {
    type: 'PRODUCER',
    id: absence.producerId,
    label: `Absence corrigée : ${describeAbsence(absence)}`
  });

  res.json({ success: true, data: { absence } });
});

// ANNULER UNE ABSENCE
const deleteProducerAbsence = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.producerAbsence.findUnique({ where: { id }, select: absenceSelect });
  if (!existing) throw new HttpNotFoundError('Absence introuvable');

  await prisma.producerAbsence.delete({ where: { id } });

  await logAudit(req, AUDIT_ACTION, 'IMPORTANT', {
    type: 'PRODUCER',
    id: existing.producerId,
    label: `Absence annulée : ${describeAbsence(existing)}`
  });

  res.json({ success: true, message: 'Absence annulée' });
});

export {
  getAllProducerAbsences,
  createProducerAbsence,
  updateProducerAbsence,
  deleteProducerAbsence
};
