import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import { HttpBadRequestError, httpStatusCodes } from '../utils/httpErrors.js';

const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    throw new HttpBadRequestError('Tous les champs sont requis.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new HttpBadRequestError('Email invalide.');
  }

  await emailService.sendContactMessage({ name, email, subject, message });

  res.status(httpStatusCodes.OK).json({
    success: true,
    message: 'Message envoyé avec succès.',
  });
});

export { sendContactMessage };
