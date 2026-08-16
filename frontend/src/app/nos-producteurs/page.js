import Link from 'next/link';
import { spellNumber, spellNumberLower } from '../../constants/numberWords';
import { fetchPublicProducers, producerPhoto, producerPlace } from '../../lib/producers';
import '../../styles/public/producers.css';

const CERTIFICATIONS = {
  ORGANIC: { label: 'Certifiée AB', className: 'badge-veggie' },
  CONVERSION: { label: 'En conversion bio', className: 'badge-veggie badge-conversion' },
};

/* Le titre s'accorde au nombre de fermes réellement publiées. Au-delà de la
   table des nombres, on retombe sur une formule qui ne compte pas. */
function buildTitle(count) {
  if (count === 1) return 'Une ferme, un nom, un visage.';
  const word = spellNumber(count);
  if (!word || count === 0) return 'Nos fermes, leurs noms, leurs visages.';
  const lower = spellNumberLower(count);
  return `${word} fermes, ${lower} noms, ${lower} visages.`;
}


/* Rendu sur le serveur : les fiches partent dans le HTML. Les robots des
   moteurs génératifs n'exécutent pas le JavaScript, et la page qui répond à
   « qui fournit cette AMAP ? » leur arrivait vide. */
export default async function ProducersPage() {
  const producers = await fetchPublicProducers();

  /* Chiffres du hero : chacun n'apparaît que si la donnée existe derrière. */
  const certified = producers.filter((p) => p.certification && p.certification !== 'NONE');
  const partnerships = producers
    .map((p) => p.partnerSince)
    .filter((year) => typeof year === 'number');

  const facts = [];
  if (producers.length > 0) {
    facts.push({
      value: String(producers.length),
      label: producers.length > 1 ? 'fermes partenaires' : 'ferme partenaire',
    });
  }
  if (certified.length > 0) {
    const share = Math.round((certified.length / producers.length) * 100);
    facts.push({ value: `${share} %`, label: 'bio ou en conversion' });
  }
  if (partnerships.length > 0) {
    facts.push({ value: String(Math.min(...partnerships)), label: 'partenaire depuis' });
  }

  return (
    <div className="producers-page">

      {/* Hero */}
      <section className="farms-hero">
        <div className="eyebrow">Les fermes partenaires</div>
        <div className="farms-hero-grid">
          <div>
            <h1 className="farms-title">{buildTitle(producers.length)}</h1>
            <p className="farms-lede">
              Nous n&apos;achetons pas à des grossistes. Chaque légume du panier vient de
              l&apos;une de ces exploitations, toutes visitées par des adhérents, et arrive
              au point de retrait de Clamart sans passer par un entrepôt.
            </p>
          </div>

          {facts.length > 0 && (
            <dl className="facts-row">
              {facts.map((fact) => (
                <div className="fact" key={fact.label}>
                  <dt className="fact-value">{fact.value}</dt>
                  <dd className="fact-label">{fact.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* L'engagement */}
      <section className="band-sand">
        <div className="farms-pledge">
          <div className="eyebrow">L&apos;engagement</div>
          <p className="farms-pledge-text">
            Le contrat va dans les deux sens : les adhérents règlent la saison à
            l&apos;avance, les producteurs s&apos;engagent sur des volumes et sur une
            agriculture sans intrant de synthèse. Les prix sont discutés une fois par an,
            en assemblée, avec les producteurs présents dans la salle.
          </p>
        </div>
      </section>

      {/* Les fiches */}
      {producers.length === 0 ? (
        <section className="farms-empty">
          <div className="farms-empty-card">
            <h2 className="farms-empty-title">Aucune ferme publiée pour l&apos;instant.</h2>
            <p className="farms-empty-text">
              Les fiches des exploitations partenaires seront mises en ligne prochainement.
            </p>
          </div>
        </section>
      ) : (
        <section className="farms-list">
          {producers.map((producer, index) => {
            const certification = CERTIFICATIONS[producer.certification];
            const place = producerPlace(producer);
            const crops = producer.products || [];
            const visible = crops.slice(0, 6);
            const extra = crops.length - visible.length;
            const photo = producerPhoto(producer, index);

            return (
              <article className="farm" key={producer.id}>
                <div className="farm-visual">
                  <div className="farm-frame">
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      loading="lazy"
                      className="farm-photo"
                    />
                    {certification && (
                      <span className={`${certification.className} farm-badge`}>
                        {certification.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="farm-body">
                  <div className="farm-head">
                    <span className="farm-index">{String(index + 1).padStart(2, '0')}</span>
                    {producer.specialty && (
                      <span className="farm-specialty">{producer.specialty}</span>
                    )}
                  </div>

                  <h2 className="farm-name">{producer.name}</h2>

                  {place && <div className="farm-place">{place}</div>}

                  {producer.description && (
                    <p className="farm-text">{producer.description}</p>
                  )}

                  {crops.length > 0 && (
                    <div className="farm-crops">
                      <div className="farm-crops-label">Productions</div>
                      <div className="farm-crops-list">
                        {visible.map((product) => (
                          <span className="farm-crop" key={product.id || product.name}>
                            {product.name}
                          </span>
                        ))}
                        {extra > 0 && (
                          <span className="farm-crop farm-crop-more">
                            + {extra} autre{extra > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <dl className="def-list farm-specs">
                    {producer.farmDetail && (
                      <div className="def-row">
                        <dt className="def-label">
                          {producer.farmDetailLabel || 'Exploitation'}
                        </dt>
                        <dd className="def-value">{producer.farmDetail}</dd>
                      </div>
                    )}

                    {producer.partnerSince && (
                      <div className="def-row">
                        <dt className="def-label">Partenaire depuis</dt>
                        <dd className="def-value farm-spec-mono">
                          {producer.partnerSince}
                        </dd>
                      </div>
                    )}

                  </dl>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Double appel */}
      <section className="band-forest farms-cta">
        <div className="farms-cta-inner">
          <div className="farms-cta-block">
            <div className="eyebrow eyebrow-on-forest">Vous cultivez, vous élevez</div>
            <h2 className="farms-cta-title">Il reste de la place à l&apos;étal.</h2>
            <p className="farms-cta-text">
              Nous cherchons surtout des fromages, du miel et des légumes d&apos;hiver.
              Débouchés garantis, contractualisés à l&apos;année, réponse sous 48 heures.
            </p>
            <Link href="/devenir-producteur" className="btn btn-primary btn-lg">
              Candidater
            </Link>
          </div>

          <div className="farms-cta-block farms-cta-second">
            <div className="eyebrow eyebrow-on-forest">Vous voulez les soutenir</div>
            <h2 className="farms-cta-title">Prenez un panier.</h2>
            <p className="farms-cta-text">
              C&apos;est le seul geste qui compte vraiment pour eux : un engagement à
              l&apos;année, payé d&apos;avance, qui leur permet de savoir quoi semer.
            </p>
            <Link href="/nos-abonnements" className="btn btn-ghost-forest btn-lg">
              Découvrir nos abonnements
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
