/* Retour après connexion : un chemin du site, rien d'autre. « //hôte », « /\hôte »
   et un blanc glissé dans « /<tab>/hôte » mènent ailleurs, le navigateur
   retirant les blancs avant de lire l'adresse. */
export function safeRedirectPath(value) {
  return typeof value === 'string' && /^\/(?!\/)[^\\\s\u0000-\u001f]*$/.test(value) ? value : '/';
}
