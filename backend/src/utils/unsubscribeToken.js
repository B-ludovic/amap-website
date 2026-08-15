/* Le laissez-passer du désabonnement.

   Une adhérente qui ne veut plus rien recevoir clique sur un lien au bas d'un
   email, un mercredi soir, sur son téléphone. Lui demander de retrouver son mot
   de passe à ce moment-là, c'est lui demander de renoncer — et « simple et
   gratuit » est précisément ce qu'exige l'article L34-5 du code des postes. Le
   lien doit donc porter lui-même la preuve de qui le tient.

   Cette preuve est une empreinte : on passe l'identifiant de la personne dans
   une machine à sceller dont seul le serveur a la clé, et le sceau obtenu voyage
   dans l'URL à côté de l'identifiant. À la réception, le serveur rescelle
   l'identifiant reçu et compare les deux sceaux. Impossible de forger le sceau
   d'un voisin sans la clé, impossible de deviner la clé depuis un sceau.

   Rien n'est écrit en base : le sceau se recalcule à l'identique à chaque fois.
   Un compte créé demain a son lien valide sans qu'on ait rien à générer, et
   changer JWT_SECRET révoque d'un coup tous les liens en circulation.

   La clé est celle des jetons de session, mais la mention « unsubscribe:v1 »
   entre dans le calcul : deux usages, deux empreintes différentes pour le même
   identifiant. Un sceau de désabonnement ne peut donc jamais être présenté
   ailleurs comme un jeton de session, ni l'inverse. */

import crypto from 'crypto';

const PURPOSE = 'unsubscribe:v1';

/* env.js a déjà refusé le démarrage si JWT_SECRET manque : on peut le lire ici
   sans repli. Un repli silencieux rendrait tous les liens forgeables. */
export function signUnsubscribe(userId) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${PURPOSE}:${userId}`)
    .digest('hex');
}

/* Comparaison à temps constant : un === s'arrête au premier caractère qui
   diffère, et la durée de la réponse trahit alors le nombre de caractères
   devinés. De quoi reconstruire un sceau octet par octet avec assez de
   patience. timingSafeEqual regarde toujours toute la chaîne. */
export function isValidUnsubscribeToken(userId, token) {
  if (typeof userId !== 'string' || typeof token !== 'string' || !userId || !token) {
    return false;
  }

  const expected = Buffer.from(signUnsubscribe(userId), 'utf8');
  const received = Buffer.from(token, 'utf8');

  /* timingSafeEqual jette si les longueurs diffèrent : on l'évite en amont, et
     la longueur d'une empreinte SHA-256 n'est un secret pour personne. */
  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

/* Deux adresses pour un même geste.

   Celle du corps de l'email mène à une page du site : un bouton, une phrase qui
   dit ce qui va cesser d'arriver et ce qui continuera, et de quoi revenir en
   arrière si le doigt a glissé. C'est le désabonnement que la personne voit.

   Celle des en-têtes n'est jamais montrée : c'est le client mail qui l'avale.
   Gmail et Yahoo affichent leur propre bouton « Se désabonner » à côté de
   l'expéditeur et postent dessus sans que le message soit même ouvert
   (RFC 8058). Elle doit donc désigner l'API, qui répond à un POST, et non une
   page Next.js qui n'en reçoit pas.

   Sans PUBLIC_API_URL, cette seconde adresse est infabriquable : l'en-tête
   retombe alors sur la page du site, sans la mention « un clic ». Le client mail
   ouvre un navigateur au lieu de désabonner sur place — dégradé, jamais cassé. */
export function unsubscribePageUrl(userId) {
  const query = new URLSearchParams({ u: userId, t: signUnsubscribe(userId) });
  return `${process.env.FRONTEND_URL}/desabonnement?${query}`;
}

export function unsubscribeHeaders(userId) {
  const query = new URLSearchParams({ u: userId, t: signUnsubscribe(userId) });
  const apiBase = process.env.PUBLIC_API_URL?.replace(/\/+$/, '');

  if (!apiBase) {
    return { 'List-Unsubscribe': `<${unsubscribePageUrl(userId)}>` };
  }

  return {
    'List-Unsubscribe': `<${apiBase}/newsletters/unsubscribe?${query}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
