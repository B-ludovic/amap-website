/* Attendre un effet plutôt qu'une promesse.

   Depuis que la diffusion d'une newsletter quitte la requête, plus personne ne
   tient la promesse de l'envoi : le contrôleur répond 202 et laisse la boucle
   tourner derrière lui. Un test ne peut donc pas l'attendre — il n'y a rien à
   attendre. Il observe l'état, comme le ferait l'écran de communication en se
   rafraîchissant.

   La boucle rend la main à la file d'événements entre deux essais, sans quoi le
   travail de fond n'avancerait jamais. Le délai de garde évite qu'un effet qui
   ne se produit pas fige la suite au lieu d'échouer en la nommant. */
export async function attendreQue(predicat, { delaiMs = 2000, intitule = 'la condition attendue' } = {}) {
  const echeance = Date.now() + delaiMs;

  while (Date.now() < echeance) {
    if (predicat()) return;

    await new Promise((resolve) => setImmediate(resolve));
  }

  throw new Error(`Délai dépassé en attendant ${intitule}`);
}
