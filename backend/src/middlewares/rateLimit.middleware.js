import rateLimit from 'express-rate-limit';
import { maskTokens } from '../utils/safeMessage.js';

/* Une ligne au premier refus de chaque fenêtre, pas à chaque refus : une attaque
   qui insiste noierait sinon les logs. Le chemin perd sa query string, qui peut
   porter un secret (?s= du webhook Brevo). */
export function signalerLimite(nom) {
  return (req, res, _next, options) => {
    const { used, limit } = req.rateLimit;

    if (used === limit + 1) {
      const chemin = maskTokens(req.originalUrl.split('?')[0]);
      console.warn(`[RateLimit] ${nom} : ${req.ip} bloqué sur ${req.method} ${chemin} après ${limit} requêtes`);
    }

    res.status(options.statusCode).send(options.message);
  };
}

// Seule porte vers express-rate-limit : un limiteur créé ailleurs refuserait en silence.
export function limiteur(nom, options) {
  return rateLimit({ ...options, handler: signalerLimite(nom) });
}
