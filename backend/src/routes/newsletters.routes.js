import express from 'express';
import {
  getAllNewsletters,
  getNewsletterById,
  createNewsletter,
  updateNewsletter,
  deleteNewsletter,
  sendNewsletter,
  scheduleNewsletter,
  unscheduleNewsletter,
  getNewsletterStats
} from '../controllers/newsletters.controller.js';
import {
  getUnsubscribeStatus,
  unsubscribe,
  resubscribe,
  setMyNewsletterPreference
} from '../controllers/newsletter-preferences.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminOnly } from '../middlewares/role.middleware.js';

const router = express.Router();

/* Le désabonnement passe avant le mur d'authentification posé plus bas : le lien
   du pied de page d'un email doit fonctionner tel quel, sans compte ouvert, y
   compris pour quelqu'un qui a oublié son mot de passe. C'est le sceau porté par
   l'URL qui autorise le geste (voir utils/unsubscribeToken.js).
   Le POST plutôt que le GET n'est pas cosmétique : les antivirus et les aperçus
   de lien visitent les URL d'un email en GET, et désabonneraient tout le monde
   avant même que le message soit lu. */
router.get('/unsubscribe', getUnsubscribeStatus);
router.post('/unsubscribe', unsubscribe);
router.post('/resubscribe', resubscribe);

/* Le même réglage vu depuis l'espace adhérent : connecté, sans être admin — donc
   ici aussi, avant le mur. */
router.put('/preferences', authMiddleware, setMyNewsletterPreference);

// Tout ce qui suit est la gestion des newsletters, réservée aux administrateurs
router.use(authMiddleware, adminOnly);

router.get('/', getAllNewsletters);
router.get('/stats', getNewsletterStats);
router.get('/:id', getNewsletterById);
router.post('/', createNewsletter);
router.put('/:id', updateNewsletter);
router.delete('/:id', deleteNewsletter);
router.post('/:id/send', sendNewsletter);
router.post('/:id/schedule', scheduleNewsletter);
router.delete('/:id/schedule', unscheduleNewsletter);

export default router;