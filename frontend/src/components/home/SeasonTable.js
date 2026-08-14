'use client';

import { useState } from 'react';

/* Catalogue de démonstration repris de la maquette : la saison filtre la liste,
   elle ne repeint plus l'interface. */
const CATALOG = {
  Printemps: {
    note: "Le printemps est maigre et vif : les premières salades, les radis, les fèves. Le panier est plus léger, il compense en fraîcheur.",
    items: [
      { name: 'Radis', ferme: 'Trois Chênes', icon: 'radis', status: 'En saison', tone: 'live' },
      { name: 'Salade', ferme: 'Trois Chênes', icon: 'salade', status: 'En saison', tone: 'live' },
      { name: 'Épinards', ferme: 'Trois Chênes', icon: 'epinard', status: 'En saison', tone: 'live' },
      { name: 'Fèves', ferme: 'Clos Bertaud', icon: 'feve', status: 'En saison', tone: 'live' },
      { name: 'Oignons nouveaux', ferme: 'Trois Chênes', icon: 'oignon', status: 'En saison', tone: 'live' },
      { name: 'Pommes de terre', ferme: 'GAEC de la Vallée', icon: 'patate', status: 'En saison', tone: 'live' },
      { name: 'Courgettes', ferme: 'Trois Chênes', icon: 'courgette', status: 'Bientôt', tone: 'soon' },
      { name: 'Tomates', ferme: 'Trois Chênes', icon: 'tomate', status: 'Bientôt', tone: 'soon' },
    ],
  },
  Été: {
    note: "Le pic de l'année. Huit à dix variétés par panier, dont les solanacées qui arrivent en masse jusqu'aux premières pluies de septembre.",
    items: [
      { name: 'Tomates', ferme: 'Trois Chênes', icon: 'tomate', status: 'En saison', tone: 'live' },
      { name: 'Courgettes', ferme: 'Trois Chênes', icon: 'courgette', status: 'En saison', tone: 'live' },
      { name: 'Aubergines', ferme: 'Trois Chênes', icon: 'aubergine', status: 'En saison', tone: 'live' },
      { name: 'Poivrons', ferme: 'Trois Chênes', icon: 'poivron', status: 'En saison', tone: 'live' },
      { name: 'Haricots verts', ferme: 'Clos Bertaud', icon: 'haricot', status: 'En saison', tone: 'live' },
      { name: 'Salade', ferme: 'Trois Chênes', icon: 'salade', status: 'En saison', tone: 'live' },
      { name: 'Carottes', ferme: 'GAEC de la Vallée', icon: 'carotte', status: 'En saison', tone: 'live' },
      { name: 'Radis', ferme: 'Trois Chênes', icon: 'radis', status: 'Terminé', tone: 'off' },
    ],
  },
  Automne: {
    note: "Les courges prennent la place des tomates. Le panier s'alourdit et se conserve : c'est la saison des soupes et des gratins.",
    items: [
      { name: 'Courges', ferme: 'Trois Chênes', icon: 'courge', status: 'En saison', tone: 'live' },
      { name: 'Choux', ferme: 'Trois Chênes', icon: 'choux', status: 'En saison', tone: 'live' },
      { name: 'Carottes', ferme: 'GAEC de la Vallée', icon: 'carotte', status: 'En saison', tone: 'live' },
      { name: 'Pommes de terre', ferme: 'GAEC de la Vallée', icon: 'patate', status: 'En saison', tone: 'live' },
      { name: 'Oignons', ferme: 'Trois Chênes', icon: 'oignon', status: 'En saison', tone: 'live' },
      { name: 'Épinards', ferme: 'Trois Chênes', icon: 'epinard', status: 'En saison', tone: 'live' },
      { name: 'Poivrons', ferme: 'Trois Chênes', icon: 'poivron', status: 'Dernière semaine', tone: 'soon' },
      { name: 'Tomates', ferme: 'Trois Chênes', icon: 'tomate', status: 'Terminé', tone: 'off' },
    ],
  },
  Hiver: {
    note: 'Quatre à cinq variétés, robustes, récoltées au fur et à mesure. Les paniers d\'hiver sont plus courts mais jamais vides.',
    items: [
      { name: 'Choux', ferme: 'Trois Chênes', icon: 'choux', status: 'En saison', tone: 'live' },
      { name: 'Courges', ferme: 'Trois Chênes', icon: 'courge', status: 'En saison', tone: 'live' },
      { name: 'Carottes', ferme: 'GAEC de la Vallée', icon: 'carotte', status: 'En saison', tone: 'live' },
      { name: 'Pommes de terre', ferme: 'GAEC de la Vallée', icon: 'patate', status: 'En saison', tone: 'live' },
      { name: 'Oignons', ferme: 'Trois Chênes', icon: 'oignon', status: 'En saison', tone: 'live' },
      { name: 'Épinards', ferme: 'Trois Chênes', icon: 'epinard', status: 'En saison', tone: 'live' },
      { name: 'Radis', ferme: 'Trois Chênes', icon: 'radis', status: 'Bientôt', tone: 'soon' },
      { name: 'Salade', ferme: 'Trois Chênes', icon: 'salade', status: 'Terminé', tone: 'off' },
    ],
  },
};

const SEASONS = Object.keys(CATALOG);

function SeasonTable({ defaultSeason = 'Été' }) {
  const [season, setSeason] = useState(
    CATALOG[defaultSeason] ? defaultSeason : 'Été'
  );
  const active = CATALOG[season];

  return (
    <>
      <div className="etal-head">
        <div>
          <div className="eyebrow">L&apos;étal · ce qu&apos;il y a dans le panier</div>
          <h2 className="section-display">Le tableau des saisons.</h2>
        </div>
        <div className="season-switch" role="group" aria-label="Choisir une saison">
          {SEASONS.map(label => (
            <button
              key={label}
              type="button"
              className={`season-pill ${label === season ? 'is-active' : ''}`}
              aria-pressed={label === season}
              onClick={() => setSeason(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="season-note">{active.note}</p>

      <div className="produce-grid">
        {active.items.map((item, i) => (
          <article className="produce-card" key={`${season}-${item.name}`}>
            <div
              className="produce-thumb"
              role="img"
              aria-label={item.name}
              style={{
                backgroundColor: `var(--tile-${(i % 4) + 1})`,
                backgroundImage: `url(/icons/${item.icon}.svg)`,
              }}
            />
            <div className="produce-body">
              <h3 className="produce-name">{item.name}</h3>
              <div className="produce-farm">{item.ferme}</div>
              <div className="produce-status">
                <span className={`produce-badge tone-${item.tone}`}>{item.status}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default SeasonTable;
