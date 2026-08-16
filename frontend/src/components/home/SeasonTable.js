'use client';

import { useState } from 'react';

/* Calendrier de saisonnalité générique : la saison filtre la liste, elle ne
   repeint plus l'interface. Aucun légume n'est attribué à une ferme nommée —
   la base ne sait pas qui cultive quoi à quelle saison, et l'inventer
   contredirait la page des fermes partenaires. */
const CATALOG = {
  Printemps: {
    note: "Le printemps est maigre et vif : les premières salades, les radis, les fèves. Le panier est plus léger, il compense en fraîcheur.",
    items: [
      { name: 'Radis', icon: 'radis', status: 'En saison', tone: 'live' },
      { name: 'Salade', icon: 'salade', status: 'En saison', tone: 'live' },
      { name: 'Épinards', icon: 'epinard', status: 'En saison', tone: 'live' },
      { name: 'Fèves', icon: 'feve', status: 'En saison', tone: 'live' },
      { name: 'Oignons nouveaux', icon: 'oignon', status: 'En saison', tone: 'live' },
      { name: 'Pommes de terre', icon: 'patate', status: 'En saison', tone: 'live' },
      { name: 'Courgettes', icon: 'courgette', status: 'Bientôt', tone: 'soon' },
      { name: 'Tomates', icon: 'tomate', status: 'Bientôt', tone: 'soon' },
    ],
  },
  Été: {
    note: "Le pic de l'année. Huit à dix variétés par panier, dont les solanacées qui arrivent en masse jusqu'aux premières pluies de septembre.",
    items: [
      { name: 'Tomates', icon: 'tomate', status: 'En saison', tone: 'live' },
      { name: 'Courgettes', icon: 'courgette', status: 'En saison', tone: 'live' },
      { name: 'Aubergines', icon: 'aubergine', status: 'En saison', tone: 'live' },
      { name: 'Poivrons', icon: 'poivron', status: 'En saison', tone: 'live' },
      { name: 'Haricots verts', icon: 'haricot', status: 'En saison', tone: 'live' },
      { name: 'Salade', icon: 'salade', status: 'En saison', tone: 'live' },
      { name: 'Carottes', icon: 'carotte', status: 'En saison', tone: 'live' },
      { name: 'Radis', icon: 'radis', status: 'Terminé', tone: 'off' },
    ],
  },
  Automne: {
    note: "Les courges prennent la place des tomates. Le panier s'alourdit et se conserve : c'est la saison des soupes et des gratins.",
    items: [
      { name: 'Courges', icon: 'courge', status: 'En saison', tone: 'live' },
      { name: 'Choux', icon: 'choux', status: 'En saison', tone: 'live' },
      { name: 'Carottes', icon: 'carotte', status: 'En saison', tone: 'live' },
      { name: 'Pommes de terre', icon: 'patate', status: 'En saison', tone: 'live' },
      { name: 'Oignons', icon: 'oignon', status: 'En saison', tone: 'live' },
      { name: 'Épinards', icon: 'epinard', status: 'En saison', tone: 'live' },
      { name: 'Poivrons', icon: 'poivron', status: 'Dernière semaine', tone: 'soon' },
      { name: 'Tomates', icon: 'tomate', status: 'Terminé', tone: 'off' },
    ],
  },
  Hiver: {
    note: 'Quatre à cinq variétés, robustes, récoltées au fur et à mesure. Les paniers d\'hiver sont plus courts mais jamais vides.',
    items: [
      { name: 'Choux', icon: 'choux', status: 'En saison', tone: 'live' },
      { name: 'Courges', icon: 'courge', status: 'En saison', tone: 'live' },
      { name: 'Carottes', icon: 'carotte', status: 'En saison', tone: 'live' },
      { name: 'Pommes de terre', icon: 'patate', status: 'En saison', tone: 'live' },
      { name: 'Oignons', icon: 'oignon', status: 'En saison', tone: 'live' },
      { name: 'Épinards', icon: 'epinard', status: 'En saison', tone: 'live' },
      { name: 'Radis', icon: 'radis', status: 'Bientôt', tone: 'soon' },
      { name: 'Salade', icon: 'salade', status: 'Terminé', tone: 'off' },
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
