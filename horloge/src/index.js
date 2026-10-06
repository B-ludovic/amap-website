/* Chaque heure, réveille l'API sur Render et lui fait lancer les jobs dus.
   Un seul appel, sans nouvelle tentative : un passage manqué est rattrapé au
   suivant, le cahier de bord de l'API sait ce qui reste dû. */

// Sous la limite de 15 minutes d'un déclencheur planifié, pour finir sur un message clair.
const DELAI_MAX_MS = 10 * 60 * 1000;

export default {
  async scheduled(_controller, env) {
    // Sans secret, l'appel serait refusé : inutile de réveiller Render pour rien.
    if (!env.JOBS_SECRET) throw new Error('JOBS_SECRET manquant : wrangler secret put JOBS_SECRET');

    const reponse = await fetch(`${env.API_URL}/jobs/tick`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.JOBS_SECRET}` },
      signal: AbortSignal.timeout(DELAI_MAX_MS),
    });

    const corps = await reponse.text();
    console.log(`[Horloge] ${reponse.status} ${corps.slice(0, 500)}`);

    // Lever marque le passage en échec dans le tableau de bord Cloudflare.
    if (!reponse.ok) throw new Error(`L'API a répondu ${reponse.status}`);
  },
};
