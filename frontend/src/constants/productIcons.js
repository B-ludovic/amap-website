// Correspondance nom de produit → pictogramme de /public/icons/.
// Les motifs sont testés dans l'ordre : les plus spécifiques d'abord
// (« pomme de terre » avant « pomme »). Sans correspondance, la vignette
// reste vide plutôt que d'afficher un légume qui n'est pas le bon.

const PRODUCT_ICONS = [
  // Sans pictogramme dédié, et posés ici pour ne pas être happés par un motif
  // plus court : « betterave » contient « bette », « pois chiche » contient « pois ».
  ['betterave', null],
  ['pois chiche', null],
  ['pomme de terre', '/icons/patate.svg'],
  ['patate', '/icons/patate.svg'],
  ['petit pois', '/icons/pea.png'],
  ['noix de coco', '/icons/noix-de-coco.svg'],
  ['citron vert', '/icons/citron-vert.svg'],
  ['pomme verte', '/icons/pomme-verte.svg'],
  ['tomate', '/icons/tomate.svg'],
  ['courgette', '/icons/courgette.svg'],
  ['aubergine', '/icons/aubergine.svg'],
  ['poivron', '/icons/poivron.svg'],
  ['piment', '/icons/piment.svg'],
  ['concombre', '/icons/concombre.svg'],
  ['cornichon', '/icons/cornichon.svg'],
  ['haricot', '/icons/haricot.svg'],
  ['feve', '/icons/feve.svg'],
  ['salade', '/icons/salade.svg'],
  ['laitue', '/icons/salade.svg'],
  ['batavia', '/icons/salade.svg'],
  ['endive', '/icons/salade.svg'],
  ['mache', '/icons/salade.svg'],
  ['roquette', '/icons/salade.svg'],
  ['epinard', '/icons/epinard.svg'],
  ['blette', '/icons/epinard.svg'],
  ['bette', '/icons/epinard.svg'],
  ['brocoli', '/icons/broncoli.svg'],
  ['chou', '/icons/choux.svg'],
  ['carotte', '/icons/carotte.svg'],
  ['radis', '/icons/radis.svg'],
  ['poireau', '/icons/oignon.svg'],
  ['echalote', '/icons/oignon.svg'],
  ['oignon', '/icons/oignon.svg'],
  ['ail', '/icons/ail.svg'],
  ['courge', '/icons/courge.svg'],
  ['potiron', '/icons/courge.svg'],
  ['citrouille', '/icons/courge.svg'],
  ['butternut', '/icons/courge.svg'],
  ['champignon', '/icons/champignon.svg'],
  ['mais', '/icons/mais.svg'],
  ['asperge', '/icons/asperge.svg'],
  ['olive', '/icons/olive.svg'],
  ['gingembre', '/icons/gingembre.svg'],
  ['fraise', '/icons/fraise.svg'],
  ['cerise', '/icons/cerise.svg'],
  ['framboise', '/icons/myrtille.svg'],
  ['myrtille', '/icons/myrtille.svg'],
  ['mure', '/icons/myrtille.svg'],
  ['raisin', '/icons/raisins.svg'],
  ['poire', '/icons/poire.svg'],
  ['pomme', '/icons/pomme.svg'],
  ['peche', '/icons/peche.svg'],
  ['nectarine', '/icons/peche.svg'],
  ['abricot', '/icons/peche.svg'],
  ['melon', '/icons/melon.svg'],
  ['pasteque', '/icons/melon.svg'],
  ['citron', '/icons/citron.svg'],
  ['clementine', '/icons/orange.svg'],
  ['mandarine', '/icons/orange.svg'],
  ['orange', '/icons/orange.svg'],
  ['banane', '/icons/banane.svg'],
  ['mangue', '/icons/mangue.svg'],
  ['ananas', '/icons/ananas.svg'],
  ['avocat', '/icons/avocat.svg'],
  ['grenade', '/icons/grenade.svg'],
  ['noisette', '/icons/noisette.svg'],
  ['cacahuete', '/icons/cacahuete.svg'],
];

// « Œufs fermiers » → « oeufs fermiers » : minuscules, sans accent ni tiret
const normalize = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/-/g, ' ');

export const getProductIcon = (name) => {
  if (!name) return null;
  const needle = normalize(name);
  const found = PRODUCT_ICONS.find(([pattern]) => needle.includes(pattern));
  return found ? found[1] : null;
};

export const PRODUCT_CATEGORY_LABELS = {
  VEGETABLES: 'Légumes',
  FRUITS: 'Fruits',
  EGGS: 'Œufs',
  GROCERY: 'Épicerie',
};
