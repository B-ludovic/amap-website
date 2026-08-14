'use client';

import Link from 'next/link';
import '../../styles/public/legal.css';

const SECTIONS = [
  { id: 'editeur', title: 'Éditeur du site' },
  { id: 'partenaire', title: 'Partenaire agricole' },
  { id: 'hebergement', title: 'Hébergement' },
  { id: 'cookies', title: 'Politique de cookies' },
  { id: 'tiers', title: 'Services tiers' },
  { id: 'propriete', title: 'Propriété intellectuelle' },
  { id: 'responsabilite', title: 'Responsabilité' },
  { id: 'donnees', title: 'Données personnelles' },
];

export default function MentionsLegalesPage() {
  return (
    <div className="legal-page">

      {/* Hero */}
      <section className="legal-hero">
        <div className="eyebrow">Informations légales</div>
        <h1 className="legal-title">Mentions légales</h1>
        <p className="legal-date">Dernière mise à jour : 30 mars 2026</p>
      </section>

      <section className="legal-body">

        <aside className="legal-aside">
          <div>
            <div className="eyebrow legal-aside-label">Sommaire</div>
            <nav className="toc legal-toc">
              {SECTIONS.map((section) => (
                <a className="toc-link" href={`#${section.id}`} key={section.id}>
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
          <Link href="/cookies" className="legal-cookie-btn">
            Gérer mes cookies
          </Link>
        </aside>

        <div className="legal-content">

          {/* Éditeur */}
          <section className="legal-section" id="editeur">
            <h2 className="legal-h2 legal-h2-table">Éditeur du site</h2>
            <dl className="def-list legal-defs">
              <div className="def-row">
                <dt className="def-label">Association</dt>
                <dd className="def-value">Aux P&apos;tits Pois — association loi 1901</dd>
              </div>
              <div className="def-row">
                <dt className="def-label">Siège social</dt>
                <dd className="def-value">
                  14, rue du Château<br />45300 Yèvre-la-Ville
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label">Contact</dt>
                <dd className="def-value">
                  <a href="mailto:auxptitspois@gmail.com" className="legal-mail">
                    auxptitspois@gmail.com
                  </a>
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label">Publication</dt>
                <dd className="def-value">Kerina Davigny, directrice de la publication</dd>
              </div>
              <div className="def-row">
                <dt className="def-label">Développement</dt>
                <dd className="def-value">
                  <a href="https://www.lechoppeducode.com" target="_blank" rel="noopener noreferrer">
                    L&apos;Echoppe du Code
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          {/* Partenaire agricole */}
          <section className="legal-section" id="partenaire">
            <h2 className="legal-h2">Partenaire agricole</h2>
            <p className="legal-text">
              L&apos;association collabore avec le producteur suivant pour la fourniture des
              paniers.
            </p>
            <div className="legal-card">
              <div className="legal-card-title">Les Trois Parcelles</div>
              <div className="legal-card-sub">Représenté par M. Simon Ronceray</div>
              <dl className="def-list legal-card-defs">
                <div className="def-row">
                  <dt className="def-label">Adresse</dt>
                  <dd className="def-value">14, rue du Château, 45300 Yèvre-la-Ville</dd>
                </div>
                <div className="def-row">
                  <dt className="def-label">SIRET</dt>
                  <dd className="def-value legal-mono">815 169 974 000 12</dd>
                </div>
                <div className="def-row">
                  <dt className="def-label">Contact</dt>
                  <dd className="def-value legal-card-contact">
                    <a href="tel:0630412867" className="legal-mail">06 30 41 28 67</a>
                    <a href="mailto:lestroisparcelles@gmail.com" className="legal-mail">
                      lestroisparcelles@gmail.com
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Hébergement */}
          <section className="legal-section" id="hebergement">
            <h2 className="legal-h2 legal-h2-table">Hébergement</h2>
            <div className="legal-hosts">
              <div className="legal-host">
                <div className="eyebrow legal-host-label">Frontend</div>
                <div className="legal-host-name">Vercel Inc.</div>
                <p className="legal-host-address">
                  340 S Lemon Ave #4133<br />Walnut, CA 91789, USA
                </p>
                <a
                  href="https://vercel.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="legal-host-link"
                >
                  vercel.com
                </a>
              </div>
              <div className="legal-host legal-host-second">
                <div className="eyebrow legal-host-label">Backend</div>
                <div className="legal-host-name">Render Services, Inc.</div>
                <p className="legal-host-address">
                  525 Brannan St, Suite 300<br />San Francisco, CA 94107, USA
                </p>
                <a
                  href="https://render.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="legal-host-link"
                >
                  render.com
                </a>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section className="legal-section" id="cookies">
            <h2 className="legal-h2">Politique de cookies</h2>
            <p className="legal-text legal-text-loose">
              Un cookie est un petit fichier texte déposé sur votre appareil lors de la
              visite d&apos;un site. Il permet de mémoriser des informations relatives à
              votre navigation. Le détail complet et le réglage de vos préférences se
              trouvent sur la <Link href="/cookies">page de gestion des cookies</Link>.
            </p>

            <h3 className="legal-h3">Cookies strictement nécessaires</h3>
            <p className="legal-text">
              Indispensables au fonctionnement du site, ils ne peuvent pas être désactivés.
            </p>
            <dl className="def-list legal-purposes">
              <div className="def-row">
                <dt className="def-label-strong">Authentification</dt>
                <dd className="def-value">
                  Vous identifier et accéder à votre espace adhérent
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Session</dt>
                <dd className="def-value">
                  Mémoriser une demande d&apos;abonnement en cours de saisie et l&apos;état
                  de connexion, dans le stockage local du navigateur
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Consentement</dt>
                <dd className="def-value">
                  Cookie <code className="legal-code">eu-consent</code> — mémorise vos
                  choix pendant 120 jours
                </dd>
              </div>
            </dl>

            <h3 className="legal-h3">Cookies analytiques (optionnels)</h3>
            <p className="legal-text legal-text-loose">
              Avec votre consentement, nous utilisons Google Analytics pour comprendre
              comment le site est utilisé. Ces statistiques sont anonymisées et servent
              uniquement à améliorer la navigation.
            </p>

            <h3 className="legal-h3">Durée de conservation</h3>
            <dl className="split-list legal-durations">
              <div className="split-row">
                <dt className="split-label">Cookie d&apos;authentification</dt>
                <dd className="split-value">7 jours</dd>
              </div>
              <div className="split-row">
                <dt className="split-label">Stockage local du navigateur</dt>
                <dd className="split-value">déconnexion</dd>
              </div>
              <div className="split-row">
                <dt className="split-label">Cookie de consentement</dt>
                <dd className="split-value">120 jours</dd>
              </div>
              <div className="split-row">
                <dt className="split-label">Cookies analytiques</dt>
                <dd className="split-value">13 mois maximum</dd>
              </div>
            </dl>

            <div className="legal-card legal-prefs">
              <div>
                <div className="legal-card-title legal-prefs-title">
                  Modifier vos préférences
                </div>
                <p className="legal-prefs-text">
                  Vous pouvez revenir sur vos choix à tout moment, sans conséquence sur
                  votre abonnement.
                </p>
              </div>
              <Link href="/cookies" className="btn btn-primary">
                Gérer mes cookies
              </Link>
            </div>
          </section>

          {/* Services tiers */}
          <section className="legal-section" id="tiers">
            <h2 className="legal-h2">Services tiers</h2>
            <p className="legal-text">
              Ce site fait appel à des services externes pour certaines fonctionnalités.
            </p>
            <dl className="def-list legal-thirds">
              <div className="def-row">
                <dt className="def-label-strong">TheMealDB</dt>
                <dd className="def-value">
                  Base de données de recettes. Les recherches d&apos;ingrédients sont
                  transmises à ce service ; aucune donnée personnelle n&apos;est envoyée.{' '}
                  <a href="https://www.themealdb.com" target="_blank" rel="noopener noreferrer">
                    themealdb.com
                  </a>
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Google Translate</dt>
                <dd className="def-value">
                  Utilisé côté serveur pour traduire les noms de recettes et
                  d&apos;ingrédients. Les termes de recherche peuvent transiter par les
                  serveurs de Google ; aucune donnée personnelle n&apos;est transmise.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Brevo</dt>
                <dd className="def-value">
                  Envoi des emails transactionnels — confirmation d&apos;abonnement,
                  notifications de panier. Votre adresse email est transmise à ce service
                  dans le cadre de l&apos;exécution du contrat.
                </dd>
              </div>
            </dl>
          </section>

          {/* Propriété intellectuelle */}
          <section className="legal-section" id="propriete">
            <h2 className="legal-h2">Propriété intellectuelle</h2>
            <p className="legal-text legal-text-loose">
              L&apos;ensemble du contenu de ce site — textes, images, logos — est la
              propriété de l&apos;association Aux P&apos;tits Pois et protégé par les lois
              sur la propriété intellectuelle.
            </p>
            <p className="legal-text">
              Les icônes de légumes sont issues du projet{' '}
              <a href="https://openmoji.org" target="_blank" rel="noopener noreferrer">
                OpenMoji
              </a>
              , publiées sous licence{' '}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY-SA 4.0
              </a>
              .
            </p>
          </section>

          {/* Responsabilité */}
          <section className="legal-section" id="responsabilite">
            <h2 className="legal-h2">Responsabilité</h2>
            <p className="legal-text legal-text-loose">
              L&apos;association s&apos;efforce de maintenir les informations publiées à
              jour et exactes, mais ne peut garantir leur exhaustivité ou leur absence
              d&apos;erreur. Elle se réserve le droit de modifier ou corriger le contenu à
              tout moment et sans préavis.
            </p>
            <p className="legal-text legal-text-loose">
              Ce site contient des liens vers des services tiers. L&apos;association
              n&apos;est pas responsable du contenu de ces sites externes et ne peut
              garantir leur disponibilité permanente.
            </p>
            <p className="legal-text">
              La disponibilité du site peut être interrompue à tout moment pour des raisons
              de maintenance ou d&apos;hébergement, sans que cela engage la responsabilité
              de l&apos;association.
            </p>
          </section>

          {/* Données personnelles */}
          <section className="legal-section legal-section-last" id="donnees">
            <h2 className="legal-h2">Données personnelles</h2>
            <p className="legal-text legal-text-loose">
              Les informations collectées sur ce site sont destinées uniquement à la gestion
              de votre abonnement et des distributions. En dehors des services tiers
              mentionnés plus haut, elles ne sont jamais transmises.
            </p>
            <p className="legal-text legal-text-spaced">
              Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de
              rectification et de suppression de vos données. L&apos;export et la
              suppression sont accessibles directement depuis votre espace adhérent ; pour
              toute autre demande, écrivez-nous.
            </p>
            <div className="legal-actions">
              <Link href="/compte" className="btn btn-secondary">
                Exporter mes données
              </Link>
              <Link href="/contact" className="btn btn-secondary">
                Nous écrire
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
