export const CONSENT_COOKIE = 'eu-consent';
export const CONSENT_DAYS = 120;
export const ANALYTICS = 'analytics';

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
/* GA4 dépose _ga et un cookie par conteneur, nommé d'après l'identifiant de mesure */
export const GA_CONTAINER_COOKIE = GA_ID ? `_ga_${GA_ID.replace(/^G-/, '')}` : null;

/* Lit le choix « mesure d'audience » directement dans le cookie écrit par
   vanilla-cookieconsent : true, false, ou null si aucun choix valide n'est
   enregistré (cookie absent, illisible, ou au format d'Orejime). */
export function readAnalyticsConsent(cookieHeader) {
  const entry = cookieHeader
    .split('; ')
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  if (!entry) return null;
  try {
    const { categories } = JSON.parse(decodeURIComponent(entry.slice(CONSENT_COOKIE.length + 1)));
    return Array.isArray(categories) ? categories.includes(ANALYTICS) : null;
  } catch {
    return null;
  }
}
