import Link from 'next/link';
import Image from 'next/image';
import SeasonTable from '../components/home/SeasonTable';
import '../styles/public/home.css';

export const metadata = {
  title: "Aux P'tits Pois - AMAP locale à Clamart",
  description: "Abonnez-vous à notre AMAP et recevez chaque semaine des légumes bio et locaux de producteurs partenaires à moins de 30 km de Clamart. Tarif solidaire disponible.",
  openGraph: {
    title: "Aux P'tits Pois - AMAP locale à Clamart",
    description: "Légumes bio et locaux livrés chaque semaine. Rejoignez notre AMAP solidaire à Clamart.",
  },
};

const MAPS_URL = 'https://maps.google.com/?q=340+Avenue+du+Général+de+Gaulle,+92140+Clamart';

/* Repli utilisé quand l'API ne répond pas : les valeurs de la maquette. */
const FALLBACK_BASKET = {
  title: 'Semaine 33 · 2026',
  items: ['Tomates', 'Courgettes', 'Basilic'],
  extra: 4,
};

async function fetchCurrentBasket() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/weekly-baskets/current`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

function basketPreview(basket) {
  if (!basket) return FALLBACK_BASKET;
  const names = (basket.items || [])
    .map(item => item.product?.name || item.customProductName)
    .filter(Boolean);
  return {
    title: `Semaine ${basket.weekNumber} · ${basket.year}`,
    items: names.slice(0, 3),
    extra: Math.max(names.length - 3, 0),
  };
}

export default async function HomePage() {
  const basket = basketPreview(await fetchCurrentBasket());

  return (
    <div className="landing">

      {/* Hero */}
      <section className="hero" id="accueil">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="live-badge">
              <span className="live-dot" aria-hidden="true" />
              <span className="live-label">Prochaine distribution — mercredi 18h15</span>
            </div>

            <h1 className="hero-title">Du champ à votre panier, sans un détour.</h1>

            <p className="hero-lede">
              Une AMAP à Clamart. Des maraîchers à moins de 30 km, un panier chaque
              mercredi, et un prix qui tient sur toute l&apos;année — solidaire pour celles
              et ceux qui en ont besoin.
            </p>

            <div className="hero-actions">
              <Link href="/nos-abonnements" className="btn btn-primary btn-lg">
                Adhérer à l&apos;association
              </Link>
              <Link href="/nos-producteurs" className="btn btn-secondary btn-lg">
                Découvrir les producteurs
              </Link>
            </div>

            <dl className="hero-stats">
              <div className="hero-stat">
                <dt className="hero-stat-value">30 km</dt>
                <dd className="hero-stat-label">rayon maximum de nos fermes partenaires</dd>
              </div>
              <div className="hero-stat">
                <dt className="hero-stat-value">49</dt>
                <dd className="hero-stat-label">semaines de distribution par an</dd>
              </div>
              <div className="hero-stat">
                <dt className="hero-stat-value">−80 %</dt>
                <dd className="hero-stat-label">tarif solidaire avec le Secours Catholique</dd>
              </div>
            </dl>
          </div>

          <div className="hero-visual">
            <div className="hero-frame">
              <Image
                src="/images/panier-hero.webp"
                alt="Panier de légumes de saison"
                width={1078}
                height={1076}
                priority
                className="hero-photo"
              />
            </div>

            <aside className="basket-card">
              <div className="eyebrow">Panier de la semaine</div>
              <div className="basket-card-title">{basket.title}</div>
              <div className="basket-card-tags">
                {basket.items.map(name => (
                  <span className="basket-tag" key={name}>{name}</span>
                ))}
                {basket.extra > 0 && (
                  <span className="basket-tag">+{basket.extra} autre{basket.extra > 1 ? 's' : ''}</span>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Le cycle */}
      <section className="band-forest">
        <div className="container cycle">
          <div className="cycle-head">
            <div>
              <div className="eyebrow">Le cycle · comment ça marche</div>
              <h2 className="section-display">Trois étapes, puis un rendez-vous chaque semaine.</h2>
            </div>
            <Link href="/nos-abonnements" className="link-underline">Voir les abonnements</Link>
          </div>

          <ol className="steps">
            <li className="step">
              <div className="step-rule">
                <span className="step-number">01</span>
                <span className="step-line" aria-hidden="true" />
              </div>
              <h3 className="step-title">Je choisis mon panier</h3>
              <p className="step-text">
                Petit panier de 2 à 4 kg, ou grand panier de 6 à 8 kg pour une famille.
                Engagement annuel sur 49 semaines.
              </p>
            </li>
            <li className="step">
              <div className="step-rule">
                <span className="step-number">02</span>
                <span className="step-line" aria-hidden="true" />
              </div>
              <h3 className="step-title">Je signe le contrat</h3>
              <p className="step-text">
                Nous vous recontactons pour finaliser l&apos;inscription et le règlement —
                chèque, virement ou espèces, en plusieurs fois.
              </p>
            </li>
            <li className="step">
              <div className="step-rule">
                <span className="step-number">03</span>
                <span className="step-line" aria-hidden="true" />
              </div>
              <h3 className="step-title">Je retire mon panier</h3>
              <p className="step-text">
                Chaque mercredi de 18h15 à 19h15, à la Paroisse Saint François de Sales.
                Deux semaines de pause possibles par an.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* L'étal */}
      <section className="etal" id="etal">
        <div className="container">
          <SeasonTable defaultSeason="Été" />
        </div>
      </section>

      {/* Point de rendez-vous */}
      <section className="band-forest">
        <div className="container meeting">
          <div>
            <div className="eyebrow eyebrow-on-forest">Le point de rendez-vous</div>
            <h2 className="section-display meeting-title">Mercredi, 18h15. On vous attend.</h2>

            <dl className="meeting-rows">
              <div className="meeting-row">
                <dt className="eyebrow eyebrow-on-forest">Adresse</dt>
                <dd className="meeting-value">
                  Paroisse Saint François de Sales<br />
                  340 avenue du Général de Gaulle<br />
                  92140 Clamart
                </dd>
              </div>
              <div className="meeting-row">
                <dt className="eyebrow eyebrow-on-forest">Créneau</dt>
                <dd className="meeting-value">
                  Chaque mercredi, <span className="mono-strong">18h15 → 19h15</span>
                </dd>
              </div>
              <div className="meeting-row">
                <dt className="eyebrow eyebrow-on-forest">Permanence</dt>
                <dd className="meeting-value">
                  Deux adhérents par distribution — environ trois fois par an et par foyer.
                </dd>
              </div>
            </dl>

            <div className="meeting-actions">
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Voir sur la carte
              </a>
              <Link href="/panier-semaine" className="btn btn-ghost-forest">
                Panier de la semaine
              </Link>
            </div>
          </div>

          <a
            className="map-slot"
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="eyebrow eyebrow-on-forest">Plan d&apos;accès</span>
            <span className="map-slot-text">
              340 avenue du Général de Gaulle, Clamart
            </span>
            <span className="map-slot-hint">Ouvrir dans Google Maps</span>
          </a>
        </div>
      </section>

      {/* Les fermes */}
      <section className="farms" id="producteurs">
        <div className="container">
          <div className="farms-head">
            <div className="eyebrow">Les fermes partenaires</div>
            <h2 className="section-display">On sait qui cultive, et où.</h2>
            <p className="farms-lede">
              Trois exploitations bio ou en conversion, toutes à moins de trente kilomètres
              du point de retrait.
            </p>
          </div>

          <div className="farms-grid">
            <article className="farm-card">
              <div className="farm-photo">
                <Image
                  src="/images/ferme-maraichage.webp"
                  alt="Maraîchage de plein champ"
                  width={1078}
                  height={1076}
                />
              </div>
              <div className="farm-body">
                <div className="eyebrow">Maraîchage · 12 km</div>
                <h3 className="farm-name">Ferme des Trois Chênes</h3>
                <p className="farm-text">
                  Légumes de plein champ et sous serre froide. Certifiée AB depuis 2016.
                </p>
              </div>
            </article>

            <article className="farm-card">
              <div className="farm-photo">
                <Image
                  src="/images/ferme-petits-fruits.webp"
                  alt="Jardin maraîcher"
                  width={1408}
                  height={768}
                />
              </div>
              <div className="farm-body">
                <div className="eyebrow">Petits fruits · 24 km</div>
                <h3 className="farm-name">Le Clos Bertaud</h3>
                <p className="farm-text">
                  Fraises, framboises et groseilles de mai à septembre. En conversion bio.
                </p>
              </div>
            </article>

            <article className="farm-card">
              <div className="farm-photo">
                <Image
                  src="/agriculteurs.png"
                  alt="Producteurs partenaires"
                  width={1024}
                  height={1024}
                />
              </div>
              <div className="farm-body">
                <div className="eyebrow">Œufs &amp; farine · 28 km</div>
                <h3 className="farm-name">GAEC de la Vallée</h3>
                <p className="farm-text">
                  Poules élevées en plein air et blé meunier écrasé à la ferme.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Les abonnements */}
      <section className="band-sand" id="abonnements">
        <div className="container pricing">
          <div>
            <div className="eyebrow">Les abonnements</div>
            <h2 className="section-display">Un prix, et il ne bouge plus.</h2>
            <p className="pricing-lede">
              49 semaines de légumes, réglées en plusieurs fois. Avec le Secours Catholique,
              le tarif solidaire ramène la part de l&apos;adhérent à 20 % du prix.
            </p>
            <div className="pricing-note">
              <span className="pricing-note-dot" aria-hidden="true" />
              <span>Abonnement découverte 12 semaines — bientôt</span>
            </div>
          </div>

          <div className="pricing-cards">
            <article className="price-card">
              <div className="eyebrow">Petit panier · 2 à 4 kg</div>
              <div className="price-amount">19,00 €</div>
              <div className="price-period">par semaine · 931 € l&apos;année</div>
              <div className="price-rule" aria-hidden="true" />
              <div className="price-features">
                <div>Idéal pour 1 à 2 personnes</div>
                <div>Deux semaines de pause par an</div>
                <div className="price-solidarity">Tarif solidaire : 186,20 €</div>
              </div>
            </article>

            <article className="price-card price-card-featured">
              <div className="price-flag">Le plus choisi</div>
              <div className="eyebrow">Grand panier · 6 à 8 kg</div>
              <div className="price-amount">29,80 €</div>
              <div className="price-period">par semaine · 1 460,20 € l&apos;année</div>
              <div className="price-rule" aria-hidden="true" />
              <div className="price-features">
                <div>Pensé pour une famille</div>
                <div>Deux semaines de pause par an</div>
                <div className="price-solidarity">Tarif solidaire : 292,04 €</div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Appel aux producteurs */}
      <section className="join">
        <div className="container">
          <div className="join-card">
            <div>
              <h2 className="join-title">Vous produisez à moins de 30 km ?</h2>
              <p className="join-text">
                Rejoignez le réseau et bénéficiez de débouchés garantis, contractualisés
                à l&apos;année.
              </p>
            </div>
            <Link href="/devenir-producteur" className="btn btn-forest btn-lg">
              Candidater
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
