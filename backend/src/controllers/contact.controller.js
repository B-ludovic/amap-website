import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import { prisma } from '../config/database.js';
import { HttpBadRequestError, HttpNotFoundError, httpStatusCodes } from '../utils/httpErrors.js';

// POST /api/contact — Envoi d'un message de contact (public)
const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    throw new HttpBadRequestError('Tous les champs sont requis.');
  }

  if (name.length > 100) throw new HttpBadRequestError('Nom : 100 caractères maximum.');
  if (subject.length > 200) throw new HttpBadRequestError('Sujet : 200 caractères maximum.');
  if (message.length > 5000) throw new HttpBadRequestError('Message : 5000 caractères maximum.');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new HttpBadRequestError('Email invalide.');
  }

  // 1. Sauvegarder en base
  const contactMessage = await prisma.contactMessage.create({
    data: { name, email, subject, message, status: 'UNREAD' }
  });

  // 2. Envoyer l'email à l'AMAP
  await emailService.sendContactMessage({ name, email, subject, message });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Message envoyé avec succès.',
    data: { id: contactMessage.id }
  });
});

// GET /api/admin/contact — Liste des messages (admin)
const getAllContactMessages = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const where = status ? { status } : {};

  const messages = await prisma.contactMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  res.json({ success: true, data: { messages } });
});

// PUT /api/admin/contact/:id/status — Mettre à jour le statut (admin)
const updateContactMessageStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ['UNREAD', 'READ', 'ARCHIVED'];
  if (!allowedStatuses.includes(status)) {
    throw new HttpBadRequestError('Statut invalide. Valeurs acceptées : UNREAD, READ, ARCHIVED.');
  }

  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpNotFoundError('Message non trouvé.');
  }

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { status }
  });

  res.json({ success: true, data: { message: updated } });
});

// DELETE /api/admin/contact/:id — Supprimer un message (admin)
const deleteContactMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpNotFoundError('Message non trouvé.');
  }

  await prisma.contactMessage.delete({ where: { id } });

  res.json({ success: true, message: 'Message supprimé.' });
});

export {
  sendContactMessage,
  getAllContactMessages,
  updateContactMessageStatus,
  deleteContactMessage
};
