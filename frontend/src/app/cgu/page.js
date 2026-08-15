'use client';

import Link from 'next/link';
import '../../styles/public/legal.css';
import '../../styles/public/cgu.css';

/* Le sommaire porte le numéro d'article à droite : un texte juridique se cite
   par son article, pas par son titre. Les identifiants restent parlants pour
   que les liens partagés se lisent (#permanences plutôt que #art4). */
const ARTICLES = [
  { id: 'objet', number: '01', title: 'Objet et champ d’application' },
  { id: 'acces', number: '02', title: 'Accès au service et création de compte' },
  { id: 'role', number: '03', title: 'Rôle du site et nature des engagements' },
  { id: 'permanences', number: '04', title: 'Permanences et vie de l’AMAP' },
  { id: 'contributions', number: '05', title: 'Contributions des utilisateurs' },
  { id: 'disponibilite', number: '06', title: 'Disponibilité et usage loyal' },
  { id: 'donnees', number: '07', title: 'Données personnelles' },
  { id: 'cloture', number: '08', title: 'Clôture de compte' },
  { id: 'modification', number: '09', title: 'Modification des CGU' },
  { id: 'litiges', number: '10', title: 'Droit applicable et litiges' },
];

/* Finalités de la plateforme, énumérées par l'article 1. */
const PURPOSES = [
  'La gestion des demandes d’adhésion et des abonnements aux paniers',
  'L’inscription et l’organisation du planning des permanences bénévoles de distribution',
  'La consultation du panier de la semaine, des actualités de l’AMAP et des recettes de cuisine',
  'Le suivi des distributions et de l’émargement hebdomadaire',
];

export default function CguPage() {
  return (
    <div className="legal-page cgu-page">

      {/* Hero */}
      <section className="legal-hero">
        <div className="eyebrow">Informations légales</div>
        <h1 className="legal-title">Conditions générales d&apos;utilisation</h1>
        <p className="legal-date">
          Version 1.0 · Dernière mise à jour : 15 août 2026
        </p>
      </section>

      <section className="legal-body">

        <aside className="legal-aside">
          <div>
            <div className="eyebrow legal-aside-label">Sommaire</div>
            <nav className="toc legal-toc">
              {ARTICLES.map((article) => (
                <a className="toc-link" href={`#${article.id}`} key={article.id}>
                  <span>{article.title}</span>
                  <span className="toc-count">{article.number}</span>
                </a>
              ))}
            </nav>
          </div>
          <Link href="/mentions-legales" className="legal-aside-btn">
            Mentions légales
          </Link>
        </aside>

        <div className="legal-content">

          <p className="legal-text cgu-preamble">
            Association Aux P&apos;tits Pois — association loi 1901. Les présentes conditions
            encadrent l&apos;accès et l&apos;utilisation du site et de l&apos;espace adhérent.
          </p>

          {/* Article 1 — Objet */}
          <section className="legal-section" id="objet">
            <div className="eyebrow cgu-article-label">Article 1</div>
            <h2 className="legal-h2">Objet et champ d&apos;application</h2>

            <p className="legal-text">
              Les présentes Conditions générales d&apos;utilisation (ci-après « CGU ») ont pour
              objet d&apos;encadrer l&apos;accès et l&apos;utilisation du site web et de
              l&apos;espace adhérent de l&apos;association Aux P&apos;tits Pois (ci-après
              « l&apos;Association »).
            </p>
            <p className="legal-text">
              La plateforme constitue un outil associatif bénévole destiné à faciliter :
            </p>

            <ul className="cgu-bullets">
              {PURPOSES.map((purpose) => (
                <li className="cgu-bullet" key={purpose}>
                  <span className="cgu-bullet-dot" aria-hidden="true" />
                  <span className="cgu-bullet-text">{purpose}</span>
                </li>
              ))}
            </ul>

            <p className="legal-text legal-text-loose">
              Les présentes CGU se complètent des{' '}
              <Link href="/mentions-legales">mentions légales</Link>, de la{' '}
              <Link href="/cookies">politique de cookies</Link> et, pour les adhérents, du
              contrat d&apos;engagement AMAP, des statuts et du règlement intérieur de
              l&apos;Association. En cas de contradiction entre les présentes CGU et le contrat
              d&apos;engagement AMAP sur les droits et obligations liés aux paniers, ce dernier
              prévaut.
            </p>

            <div className="notice-band cgu-notice">
              <span className="notice-band-dot" aria-hidden="true" />
              <span className="notice-band-text">
                <strong>Acceptation.</strong> La navigation sur les pages publiques du site vaut
                prise de connaissance des présentes CGU. La création d&apos;un compte adhérent
                est en revanche subordonnée à leur acceptation expresse, matérialisée par une
                case à cocher lors de l&apos;inscription. La date et la version des CGU acceptées
                sont conservées par l&apos;Association à titre de preuve.
              </span>
            </div>
          </section>

          {/* Article 2 — Accès au service */}
          <section className="legal-section" id="acces">
            <div className="eyebrow cgu-article-label">Article 2</div>
            <h2 className="legal-h2 legal-h2-table">
              Accès au service et création de compte
            </h2>

            <dl className="def-list cgu-defs">
              <div className="def-row">
                <dt className="def-label-strong">Éligibilité</dt>
                <dd className="def-value">
                  L&apos;accès aux fonctionnalités publiques est ouvert à tout visiteur. La
                  création d&apos;un compte adhérent est réservée aux personnes physiques
                  majeures ou aux personnes morales valablement représentées.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Exactitude des informations</dt>
                <dd className="def-value">
                  Lors de son inscription ou du dépôt d&apos;une demande d&apos;abonnement,
                  l&apos;utilisateur s&apos;engage à fournir des informations véridiques,
                  complètes et à jour (identité, coordonnées de contact, adresse postale). Il lui
                  appartient de les mettre à jour depuis son espace adhérent en cas de changement.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Sécurité des identifiants</dt>
                <dd className="def-value">
                  Le mot de passe et les accès au compte sont strictement personnels et
                  confidentiels. L&apos;adhérent est responsable de la conservation et de
                  l&apos;usage de ses identifiants ; toute action effectuée depuis son compte est
                  présumée émaner de lui, sauf preuve contraire. En cas de suspicion de
                  compromission, l&apos;adhérent doit sans délai réinitialiser son mot de passe et
                  en informer l&apos;Association.
                </dd>
              </div>
            </dl>
          </section>

          {/* Article 3 — Rôle du site */}
          <section className="legal-section" id="role">
            <div className="eyebrow cgu-article-label">Article 3</div>
            <h2 className="legal-h2 legal-h2-table">
              Rôle du site et nature des engagements
            </h2>

            <dl className="def-list cgu-defs">
              <div className="def-row">
                <dt className="def-label-strong">Outil de gestion associative</dt>
                <dd className="def-value">
                  La plateforme est un outil technique de gestion interne à l&apos;Association.
                  Elle ne constitue pas une place de marché ni un site de commerce électronique :
                  aucune vente n&apos;y est conclue, aucun paiement n&apos;y est encaissé.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Parties au contrat de panier</dt>
                <dd className="def-value">
                  L&apos;abonnement aux paniers repose sur un contrat d&apos;engagement AMAP
                  conclu entre l&apos;adhérent et le producteur partenaire identifié dans les{' '}
                  <Link href="/mentions-legales">mentions légales</Link>. L&apos;Association
                  n&apos;est ni vendeur, ni revendeur, ni mandataire de paiement : elle assure la
                  mise en relation, l&apos;organisation logistique des distributions et la gestion
                  administrative de l&apos;adhésion.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Formalisation</dt>
                <dd className="def-value">
                  La demande d&apos;abonnement déposée sur le site constitue une demande, et non
                  un contrat. Elle ne devient effective qu&apos;après validation par
                  l&apos;Association, signature du contrat d&apos;engagement AMAP et remise des
                  règlements dans les conditions prévues par ce contrat. Les droits et devoirs
                  liés aux paniers — notamment le partage des aléas de production, le calendrier
                  de livraison et les conditions d&apos;interruption ou de report — sont régis par
                  ce contrat, les statuts et le règlement intérieur de l&apos;Association, et non
                  par les présentes CGU.
                </dd>
              </div>
            </dl>
          </section>

          {/* Article 4 — Permanences */}
          <section className="legal-section" id="permanences">
            <div className="eyebrow cgu-article-label">Article 4</div>
            <h2 className="legal-h2 legal-h2-table">
              Permanences et participation à la vie de l&apos;AMAP
            </h2>

            <dl className="def-list cgu-defs">
              <div className="def-row">
                <dt className="def-label-strong">Engagement bénévole</dt>
                <dd className="def-value">
                  Conformément à la charte des AMAP, l&apos;adhérent souscrivant un abonnement
                  s&apos;engage à participer aux permanences de distribution selon les modalités
                  fixées par l&apos;Association.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Inscriptions et désistements</dt>
                <dd className="def-value">
                  Les créneaux de permanence réservés via l&apos;espace adhérent valent engagement
                  moral envers le collectif. En cas d&apos;indisponibilité imprévue,
                  l&apos;adhérent libère son créneau sur la plateforme dans les meilleurs délais
                  ou organise son remplacement avec un autre membre.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Portée</dt>
                <dd className="def-value">
                  Le non-respect répété de cet engagement relève de la vie associative et est
                  traité selon le règlement intérieur ; il ne donne lieu à aucune pénalité
                  financière au titre des présentes CGU.
                </dd>
              </div>
            </dl>
          </section>

          {/* Article 5 — Contributions */}
          <section className="legal-section" id="contributions">
            <div className="eyebrow cgu-article-label">Article 5</div>
            <h2 className="legal-h2 legal-h2-table">Contributions des utilisateurs</h2>

            <dl className="def-list cgu-defs">
              <div className="def-row">
                <dt className="def-label-strong">Garanties de l&apos;auteur</dt>
                <dd className="def-value">
                  Lorsque les adhérents ont la possibilité de proposer ou de publier des recettes,
                  conseils, photographies ou contenus textuels, ils garantissent en être les
                  auteurs ou détenir les droits nécessaires, et ne porter atteinte à aucun droit
                  de tiers (droit d&apos;auteur, droit à l&apos;image, vie privée).
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Licence d&apos;exploitation</dt>
                <dd className="def-value">
                  En publiant un contenu sur la plateforme, l&apos;adhérent concède à
                  l&apos;Association une licence gratuite, non exclusive et révocable, pour le
                  seul besoin de la diffusion de ce contenu sur le site et, le cas échéant, dans
                  les communications de l&apos;AMAP (lettre d&apos;information, affichage en
                  distribution). Cette licence est consentie pour la durée de publication du
                  contenu et prend fin lors de son retrait, sous réserve des supports déjà
                  diffusés. L&apos;adhérent peut demander le retrait de sa contribution à tout
                  moment.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Modération</dt>
                <dd className="def-value">
                  Tout contenu contraire à la loi ou à l&apos;ordre public, diffamatoire,
                  injurieux, discriminatoire, à caractère publicitaire ou sans lien avec
                  l&apos;objet de l&apos;AMAP est prohibé. L&apos;Association peut refuser la
                  publication d&apos;un contenu ou le retirer, sans préavis, en informant son
                  auteur. Elle ne modifie pas un contenu publié sans l&apos;accord de son auteur,
                  hors corrections mineures de forme (orthographe, mise en page).
                </dd>
              </div>
            </dl>

            <div className="legal-card cgu-card">
              <div className="legal-card-title">Signalement d&apos;un contenu illicite</div>
              <p className="legal-text cgu-card-text">
                Au titre des contenus mis en ligne par les adhérents, l&apos;Association agit
                comme hébergeur au sens de l&apos;article 6-I-2 de la loi n° 2004-575 du 21 juin
                2004 pour la confiance dans l&apos;économie numérique. Tout contenu manifestement
                illicite peut être signalé à l&apos;adresse de contact figurant dans les mentions
                légales ; l&apos;Association procédera à son retrait dans les meilleurs délais.
              </p>
              <Link href="/contact" className="btn btn-secondary">
                Signaler un contenu
              </Link>
            </div>
          </section>

          {/* Article 6 — Disponibilité */}
          <section className="legal-section" id="disponibilite">
            <div className="eyebrow cgu-article-label">Article 6</div>
            <h2 className="legal-h2 legal-h2-table">Disponibilité technique et usage loyal</h2>

            <dl className="def-list cgu-defs">
              <div className="def-row">
                <dt className="def-label-strong">Disponibilité</dt>
                <dd className="def-value">
                  L&apos;Association s&apos;efforce d&apos;assurer un accès continu au site mais
                  n&apos;est tenue qu&apos;à une obligation de moyens. L&apos;accès peut être
                  suspendu, sans préavis ni indemnité, pour des opérations de maintenance ou de
                  mise à jour, ou en cas de défaillance des réseaux et de l&apos;hébergeur.
                  L&apos;Association ne saurait être tenue responsable d&apos;une indisponibilité
                  qui ne lui est pas imputable ; l&apos;organisation matérielle des distributions
                  se poursuit en tout état de cause selon les modalités habituelles.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Usage loyal</dt>
                <dd className="def-value">
                  Il est interdit de compromettre l&apos;intégrité ou la sécurité de la
                  plateforme, de tenter d&apos;accéder sans droit à des zones réservées ou
                  administratives, de contourner les mécanismes d&apos;authentification ou de
                  procéder à des extractions massives et automatisées de données (scraping). De
                  tels agissements sont susceptibles de relever des articles 323-1 et suivants du
                  code pénal et entraînent la clôture immédiate du compte.
                </dd>
              </div>
            </dl>
          </section>

          {/* Article 7 — Données personnelles */}
          <section className="legal-section" id="donnees">
            <div className="eyebrow cgu-article-label">Article 7</div>
            <h2 className="legal-h2">Données personnelles</h2>

            <p className="legal-text legal-text-loose">
              Les traitements de données mis en œuvre par l&apos;Association (gestion des
              adhésions et abonnements, organisation des permanences, envoi d&apos;informations
              aux adhérents, mesure d&apos;audience) sont décrits dans les{' '}
              <Link href="/mentions-legales">mentions légales</Link> et la{' '}
              <Link href="/cookies">politique de cookies</Link> du site.
            </p>
            <p className="legal-text legal-text-spaced">
              L&apos;adhérent dispose des droits d&apos;accès, de rectification,
              d&apos;effacement, de limitation, d&apos;opposition et de portabilité prévus par le
              RGPD. L&apos;export et la suppression des données sont accessibles directement
              depuis l&apos;espace adhérent ; toute autre demande peut être adressée à
              l&apos;Association à l&apos;adresse figurant dans les mentions légales.
              L&apos;adhérent dispose en outre du droit d&apos;introduire une réclamation auprès
              de la CNIL.
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

          {/* Article 8 — Clôture de compte */}
          <section className="legal-section" id="cloture">
            <div className="eyebrow cgu-article-label">Article 8</div>
            <h2 className="legal-h2 legal-h2-table">Clôture de compte</h2>

            <dl className="def-list cgu-defs">
              <div className="def-row">
                <dt className="def-label-strong">À l&apos;initiative de l&apos;adhérent</dt>
                <dd className="def-value">
                  L&apos;utilisateur peut supprimer son compte depuis son profil. Cette
                  suppression met fin à l&apos;accès à l&apos;espace adhérent ; elle n&apos;éteint
                  pas les obligations financières et contractuelles en cours issues d&apos;un
                  contrat d&apos;engagement AMAP signé pour la saison, ni l&apos;engagement
                  associatif jusqu&apos;à son terme.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">Conservation résiduelle</dt>
                <dd className="def-value">
                  Certaines données ne peuvent être effacées immédiatement lorsque leur
                  conservation est nécessaire au respect d&apos;une obligation légale ou à la
                  constatation d&apos;un droit : pièces comptables et justificatifs de règlement,
                  historique d&apos;adhésion pour la saison en cours. Elles sont conservées pour
                  la durée légale applicable, puis supprimées.
                </dd>
              </div>
              <div className="def-row">
                <dt className="def-label-strong">À l&apos;initiative de l&apos;Association</dt>
                <dd className="def-value">
                  L&apos;Association peut suspendre ou clôturer l&apos;accès d&apos;un adhérent en
                  cas de non-respect des présentes CGU, de non-règlement de son abonnement ou de
                  manquement grave aux règles de fonctionnement de l&apos;AMAP. Sauf urgence
                  tenant à la sécurité de la plateforme, cette mesure est précédée d&apos;une
                  information de l&apos;intéressé lui permettant de présenter ses observations.
                  L&apos;exclusion de l&apos;Association en tant que membre relève, quant à elle,
                  de la procédure prévue par les statuts.
                </dd>
              </div>
            </dl>
          </section>

          {/* Article 9 — Modification */}
          <section className="legal-section" id="modification">
            <div className="eyebrow cgu-article-label">Article 9</div>
            <h2 className="legal-h2">Modification des CGU</h2>

            <p className="legal-text">
              L&apos;Association peut modifier les présentes CGU afin de les adapter aux
              évolutions de la plateforme ou de la réglementation. Toute modification
              substantielle est portée à la connaissance des adhérents par affichage sur le site
              et notification électronique, au moins quinze (15) jours avant son entrée en
              vigueur. L&apos;adhérent qui refuse les nouvelles CGU peut supprimer son compte dans
              ce délai, sans que cela n&apos;affecte les engagements pris au titre du contrat
              d&apos;engagement AMAP en cours. La version applicable est celle en vigueur à la
              date d&apos;utilisation du site ; les versions successives sont datées et
              numérotées.
            </p>

            <dl className="split-list cgu-version">
              <div className="split-row">
                <dt className="split-label">Version en vigueur</dt>
                <dd className="split-value">1.0</dd>
              </div>
              <div className="split-row">
                <dt className="split-label">Entrée en vigueur</dt>
                <dd className="split-value">15 août 2026</dd>
              </div>
            </dl>
          </section>

          {/* Article 10 — Litiges */}
          <section className="legal-section legal-section-last" id="litiges">
            <div className="eyebrow cgu-article-label">Article 10</div>
            <h2 className="legal-h2">Droit applicable et règlement des litiges</h2>

            <p className="legal-text legal-text-loose">
              Les présentes CGU sont régies par le droit français.
            </p>
            <p className="legal-text">
              En cas de différend, l&apos;utilisateur est invité à contacter l&apos;Association
              afin de rechercher une solution amiable. À défaut d&apos;accord, les parties peuvent
              recourir gratuitement à un conciliateur de justice. Le différend peut également être
              porté devant les juridictions compétentes selon les règles de droit commun.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
