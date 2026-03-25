// Légumes de saison avec correspondance FR/EN pour l'API TheMealDB
// queryFr : affiché dans la barre de recherche
// queryEn : envoyé directement à l'API (pas de traduction nécessaire)
// icon    : chemin vers le SVG dans /public/icons/

export const SEASONAL_VEGETABLES = {
  spring: [
    { id: 'radish',    name: 'Radis',         icon: '/icons/radis.svg',    queryFr: 'radis',          queryEn: 'radish' },
    { id: 'spinach',   name: 'Épinards',       icon: '/icons/epinard.svg',  queryFr: 'épinard',        queryEn: 'spinach' },
    { id: 'asparagus', name: 'Asperges',       icon: '/icons/asperge.svg',  queryFr: 'asperge',        queryEn: 'asparagus' },
    { id: 'pea',       name: 'Petits pois',    icon: '/icons/pea.png',      queryFr: 'petit pois',     queryEn: 'pea' },
    { id: 'leek',      name: 'Poireaux',       icon: '/icons/oignon.svg',   queryFr: 'poireau',        queryEn: 'leek' },
    { id: 'carrot',    name: 'Carottes',       icon: '/icons/carotte.svg',  queryFr: 'carotte',        queryEn: 'carrot' },
  ],
  summer: [
    { id: 'tomato',    name: 'Tomates',        icon: '/icons/tomate.svg',   queryFr: 'tomate',         queryEn: 'tomato' },
    { id: 'zucchini',  name: 'Courgettes',     icon: '/icons/courgette.svg',queryFr: 'courgette',      queryEn: 'zucchini' },
    { id: 'eggplant',  name: 'Aubergines',     icon: '/icons/aubergine.svg',queryFr: 'aubergine',      queryEn: 'eggplant' },
    { id: 'pepper',    name: 'Poivrons',       icon: '/icons/poivron.svg',  queryFr: 'poivron',        queryEn: 'bell pepper' },
    { id: 'cucumber',  name: 'Concombres',     icon: '/icons/concombre.svg',queryFr: 'concombre',      queryEn: 'cucumber' },
    { id: 'bean',      name: 'Haricots verts', icon: '/icons/haricot.svg',  queryFr: 'haricot',        queryEn: 'green bean' },
  ],
  autumn: [
    { id: 'squash',    name: 'Courges',        icon: '/icons/courge.svg',   queryFr: 'courge',         queryEn: 'squash' },
    { id: 'mushroom',  name: 'Champignons',    icon: '/icons/champignon.svg',queryFr: 'champignon',    queryEn: 'mushroom' },
    { id: 'cabbage',   name: 'Choux',          icon: '/icons/choux.svg',    queryFr: 'chou',           queryEn: 'cabbage' },
    { id: 'potato',    name: 'Pommes de terre',icon: '/icons/patate.svg',   queryFr: 'pomme de terre', queryEn: 'potato' },
    { id: 'pumpkin',   name: 'Potirons',       icon: '/icons/courge.svg',   queryFr: 'potiron',        queryEn: 'pumpkin' },
    { id: 'spinach',   name: 'Épinards',       icon: '/icons/epinard.svg',  queryFr: 'épinard',        queryEn: 'spinach' },
  ],
  winter: [
    { id: 'leek',      name: 'Poireaux',       icon: '/icons/oignon.svg',   queryFr: 'poireau',        queryEn: 'leek' },
    { id: 'potato',    name: 'Pommes de terre',icon: '/icons/patate.svg',   queryFr: 'pomme de terre', queryEn: 'potato' },
    { id: 'carrot',    name: 'Carottes',       icon: '/icons/carotte.svg',  queryFr: 'carotte',        queryEn: 'carrot' },
    { id: 'cabbage',   name: 'Choux',          icon: '/icons/choux.svg',    queryFr: 'chou',           queryEn: 'cabbage' },
    { id: 'endive',    name: 'Endives',        icon: '/icons/salade.svg',   queryFr: 'endive',         queryEn: 'endive' },
    { id: 'mushroom',  name: 'Champignons',    icon: '/icons/champignon.svg',queryFr: 'champignon',    queryEn: 'mushroom' },
  ],
};

// mars–mai → printemps, juin–août → été, sept–nov → automne, déc–fév → hiver
export const getCurrentSeason = () => {
  const month = new Date().getMonth(); // 0 = janvier
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
};

export const SEASON_LABELS = {
  spring: 'Printemps',
  summer: 'Été',
  autumn: 'Automne',
  winter: 'Hiver',
};
