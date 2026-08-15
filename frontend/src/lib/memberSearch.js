/* Recherche d'adhérents pour les écrans d'administration.

   Isolée ici plutôt qu'écrite dans la page : c'est une règle métier — « ce
   qu'un bénévole tape doit retrouver la bonne personne » — et non un détail de
   présentation. Elle est donc testable seule et réutilisable par un autre écran
   qui listerait des adhérents. */

/* Ramène deux graphies au même texte comparable : minuscules, puis
   décomposition Unicode NFD, qui sépare « é » en un « e » suivi d'un accent
   combinant, dont on retire ensuite toutes les marques diacritiques.

   Sans cette étape, taper « zoe » ne trouve pas « Zoé » et « muller » ne trouve
   pas « Müller » : deux cas ordinaires sur des noms français, alors qu'au
   comptoir on tape vite, en minuscules et sans accents. */
export const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/* Tout ce qui est affiché sur une ligne est cherchable : on doit pouvoir taper
   ce qu'on a sous les yeux, y compris un numéro d'abonnement ou les derniers
   chiffres d'un téléphone. */
export const memberHaystack = (item) => normalize([
  item.user?.firstName,
  item.user?.lastName,
  item.subscriptionNumber,
  item.user?.email,
  item.user?.phone,
].join(' '));

/* Chaque mot tapé doit se retrouver quelque part dans la ligne, et non la
   phrase entière : « jean dupont » et « dupont jean » fonctionnent donc aussi
   bien l'un que l'autre, là où une simple sous-chaîne échouerait sur les deux
   puisque ni le prénom ni le nom ne contient l'expression complète. */
export function filterMembers(items, searchTerm) {
  const tokens = normalize(searchTerm).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return items;

  return items.filter((item) => {
    const haystack = memberHaystack(item);
    return tokens.every((token) => haystack.includes(token));
  });
}
