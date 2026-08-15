/* Un aller-retour HTTP sans serveur, pour appeler un contrôleur à la main. */

export function reponseFactice() {
  const res = {
    statutHttp: 200,
    corps: null,
    status(code) { this.statutHttp = code; return this; },
    json(payload) { this.corps = payload; return this; },
  };

  return res;
}

/* Le piège d'asyncHandler : il enveloppe l'appel dans
   `Promise.resolve(fn(...)).catch(next)` et ne rend pas cette promesse. La
   fonction qu'il produit retourne donc undefined, et un `await` posé dessus
   rend la main avant que le contrôleur ait touché à quoi que ce soit — les
   assertions passeraient alors sur une réponse encore vide.

   On n'attend donc pas le retour de l'appel mais son effet : la première des
   deux sorties possibles, res.json pour une réponse, next pour une erreur. Le
   délai de garde évite qu'un contrôleur qui ne fait ni l'un ni l'autre fige la
   suite au lieu d'échouer. */
export async function appeler(controleur, req = {}, { delaiMs = 2000 } = {}) {
  const res = reponseFactice();
  let erreur = null;

  await new Promise((resolve, reject) => {
    const minuterie = setTimeout(
      () => reject(new Error('Le contrôleur n\'a ni répondu ni signalé d\'erreur')),
      delaiMs
    );
    const terminer = () => { clearTimeout(minuterie); resolve(); };

    const json = res.json.bind(res);
    res.json = (payload) => { const sortie = json(payload); terminer(); return sortie; };

    controleur(req, res, (err) => { erreur = err; terminer(); });
  });

  return {
    erreur,
    statut: erreur ? erreur.statusCode : res.statutHttp,
    corps: res.corps,
    message: erreur ? erreur.message : res.corps?.message,
  };
}
