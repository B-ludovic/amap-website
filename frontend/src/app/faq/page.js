'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { spellNumber } from '../../constants/numberWords';
import '../../styles/public/faq.css';

const FAQ_CATEGORIES = [
  {
    id: 'abonnement',
    title: "L'abonnement",
    items: [
      {
        question: "Comment fonctionne un abonnement AMAP ?",
        answer: "En rejoignant Aux P'tits Pois, vous vous engagez sur une année à recevoir chaque semaine un panier de légumes frais et de saison, cultivés par nos producteurs locaux. Vous venez récupérer votre panier chaque mercredi de 18h15 à 19h15 au point de retrait. C'est un engagement mutuel : vous soutenez le producteur en avance, et il vous garantit des produits de qualité tout au long de l'année."
      },
      {
        question: "Qu'est-ce que le tarif solidaire ?",
        answer: "Le tarif solidaire est une formule à prix réduit destinée aux personnes en situation de précarité financière (bénéficiaires de minima sociaux, étudiants boursiers, etc.). Il permet à tous d'accéder à des produits locaux et bio sans contrainte de budget. Ce tarif est basé sur la confiance — si vous pensez y avoir droit, n'hésitez pas à le sélectionner lors de votre demande d'abonnement."
      },
      {
        question: "Combien de paniers vais-je recevoir par an ?",
        answer: "Vous recevrez 49 paniers par an. L'AMAP ferme 3 semaines dans l'année (congés, jours fériés, etc.), ce qui correspond à 52 semaines moins 3 semaines de fermeture. Vous serez prévenu(e) à l'avance par email et newsletter lors de chaque période de fermeture."
      },
      {
        question: "Puis-je mettre mon abonnement en pause ?",
        answer: "Oui, il est possible de mettre votre abonnement en pause jusqu'à 2 semaines par an, par exemple pour des vacances. La demande se fait auprès de l'équipe de l'AMAP qui gérera la pause depuis l'interface d'administration. Votre compteur de paniers restants est ajusté automatiquement."
      },
    ]
  },
  {
    id: 'panier',
    title: "Le contenu du panier",
    items: [
      {
        question: "Les produits sont-ils toujours bio ?",
        answer: "Oui, tous nos producteurs partenaires pratiquent une agriculture biologique ou en conversion vers le bio. Les légumes sont cultivés sans pesticides ni engrais chimiques. Certains producteurs sont certifiés AB (Agriculture Biologique), d'autres s'inscrivent dans une démarche équivalente sans avoir encore la certification officielle."
      },
      {
        question: "Le panier contient-il uniquement des légumes de saison ?",
        answer: "Absolument. Le principe fondateur de l'AMAP est de consommer local et de saison. Le contenu du panier change donc chaque semaine en fonction des récoltes. En hiver vous trouverez carottes, poireaux, courges ; au printemps radis, salades et asperges ; en été tomates, courgettes et haricots. C'est la diversité de la nature au fil des saisons !"
      },
      {
        question: "Qui décide du contenu du panier ?",
        answer: "C'est le producteur qui décide du contenu du panier en fonction de ses récoltes de la semaine. L'AMAP publie chaque semaine la composition du panier sur la page « Panier de la semaine » afin que vous puissiez anticiper vos recettes. Vous pouvez d'ailleurs consulter des suggestions de recettes directement basées sur le panier de la semaine sur notre site."
      },
    ]
  },
  {
    id: 'paiement',
    title: "Paiement",
    items: [
      {
        question: "Quels moyens de paiement sont acceptés ?",
        answer: "Le paiement s'effectue uniquement par chèque. Lors de la validation de votre abonnement, vous remettrez vos chèques directement à l'équipe de l'AMAP au point de retrait. Pour un abonnement annuel, vous pouvez régler en plusieurs chèques (généralement mensuels ou trimestriels). Les modalités exactes vous seront précisées à la validation de votre contrat."
      },
    ]
  },
  {
    id: 'compte',
    title: "Mon compte",
    items: [
      {
        question: "J'ai oublié mon mot de passe, que faire ?",
        answer: "Sur la page de connexion, cliquez sur « Mot de passe oublié ? ». Saisissez votre adresse email et vous recevrez un lien de réinitialisation valable 1 heure. Si vous ne recevez pas l'email, pensez à vérifier vos spams. En cas de problème persistant, contactez-nous directement via la page Contact."
      },
      {
        question: "Comment renouveler mon abonnement ?",
        answer: "Vous recevrez automatiquement un email de rappel 30 jours avant la fin de votre abonnement. Pour renouveler, il vous suffit de faire une nouvelle demande d'abonnement en ligne via la page « Nos Abonnements », ou de contacter directement l'équipe de l'AMAP par email. Votre historique et vos préférences seront conservés."
      },
    ]
  },
];

/* Chaque question reçoit une clé stable dès le départ : le filtre de recherche
   redécoupe les listes, mais l'état ouvert/fermé doit survivre au filtrage. */
const CATEGORIES = FAQ_CATEGORIES.map((category) => ({
  ...category,
  items: category.items.map((item, index) => ({ ...item, key: `${category.id}-${index}` })),
}));

const TOTAL_QUESTIONS = FAQ_CATEGORIES.reduce((n, c) => n + c.items.length, 0);

/* Recherche insensible aux accents : « chèque » doit répondre à « cheque ».
   NFD sépare la lettre de son accent, la plage U+0300–U+036F retire l'accent. */
function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function plural(count, singular, pluralForm) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export default function FaqPage() {
  const [openItems, setOpenItems] = useState({});
  const [allOpen, setAllOpen] = useState(false);
  const [query, setQuery] = useState('');

  const search = normalize(query.trim());

  /* Les rubriques vides disparaissent pendant une recherche, sommaire compris. */
  const categories = useMemo(() => {
    if (!search) return CATEGORIES;
    return CATEGORIES
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            normalize(item.question).includes(search) ||
            normalize(item.answer).includes(search)
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [search]);

  const found = categories.reduce((n, c) => n + c.items.length, 0);

  const toggle = (key) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
    setAllOpen(false);
  };

  const toggleAll = () => {
    const next = !allOpen;
    const map = {};
    if (next) {
      CATEGORIES.forEach((category) => {
        category.items.forEach((item) => { map[item.key] = true; });
      });
    }
    setOpenItems(map);
    setAllOpen(next);
  };

  /* Une recherche en cours ouvre les réponses trouvées : c'est le texte qui a
     répondu, le cacher derrière un clic n'aurait pas de sens. */
  const isOpen = (key) => Boolean(search) || Boolean(openItems[key]);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_CATEGORIES.flatMap(category =>
      category.items.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer
        }
      }))
    )
  };

  /* « Dix réponses » suit le nombre de questions réellement présentes. */
  const countInWords = spellNumber(TOTAL_QUESTIONS, { feminine: true });

  return (
    <div className="faq-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero */}
      <section className="faq-hero">
        <div className="eyebrow">Questions fréquentes</div>
        <h1 className="faq-title">Ce qu&apos;on nous demande le plus souvent.</h1>
        <p className="faq-lede">
          {countInWords ? `${countInWords} réponses` : 'Des réponses'} écrites par les
          bénévoles de l&apos;AMAP. Si la vôtre n&apos;y est pas, écrivez-nous : on répond
          sous 48 heures et la question finit souvent ici.
        </p>

        <div className="faq-search">
          <label className="sr-only" htmlFor="faq-query">Chercher dans la FAQ</label>
          <input
            type="text"
            id="faq-query"
            className="input faq-search-input"
            placeholder="Chercher dans la FAQ — pause, chèque, bio…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="faq-search-count" aria-live="polite">
            {search
              ? plural(found, 'réponse trouvée', 'réponses trouvées')
              : `${TOTAL_QUESTIONS} questions, ${FAQ_CATEGORIES.length} rubriques`}
          </span>
          {search && (
            <button type="button" className="faq-search-clear" onClick={() => setQuery('')}>
              Effacer
            </button>
          )}
        </div>
      </section>

      {/* Sommaire + questions */}
      <section className="faq-body">
        <aside className="faq-aside">
          <div>
            <div className="eyebrow faq-aside-label">Sur cette page</div>
            <nav className="toc faq-summary">
              {categories.map((category) => (
                <a className="toc-link" href={`#${category.id}`} key={category.id}>
                  <span>{category.title}</span>
                  <span className="toc-count">{category.items.length}</span>
                </a>
              ))}
            </nav>
          </div>

          <button type="button" className="faq-toggle-all" onClick={toggleAll}>
            {allOpen ? 'Tout replier' : 'Tout déplier'}
          </button>

          <div className="forest-card">
            <div className="eyebrow">Sans réponse ?</div>
            <p className="forest-card-text faq-forest-text">
              Écrivez au collectif. Un bénévole vous répond sous 48 heures.
            </p>
            <Link href="/contact" className="forest-card-link forest-card-link-primary">
              Nous contacter
            </Link>
          </div>
        </aside>

        <div className="faq-main">
          {categories.map((category) => (
            <section className="faq-group" id={category.id} key={category.id}>
              <div className="faq-group-head">
                <h2 className="faq-group-title">{category.title}</h2>
                <span className="faq-group-count">
                  {plural(category.items.length, 'question', 'questions')}
                </span>
              </div>

              <div className="faq-list">
                {category.items.map((item) => {
                  const key = item.key;
                  const open = isOpen(key);

                  return (
                    <div className={`faq-item${open ? ' faq-item-open' : ''}`} key={key}>
                      <button
                        type="button"
                        className="faq-question"
                        onClick={() => toggle(key)}
                        aria-expanded={open}
                        aria-controls={`faq-answer-${key}`}
                      >
                        <span className="faq-question-text">{item.question}</span>
                        <span className="faq-question-sign" aria-hidden="true">
                          {open ? '−' : '+'}
                        </span>
                      </button>
                      {open && (
                        <div className="faq-answer" id={`faq-answer-${key}`}>
                          <p className="faq-answer-text">{item.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {found === 0 && (
            <div className="faq-empty">
              <div className="faq-empty-title">Aucune question ne correspond</div>
              <p className="faq-empty-text">
                Posez-la directement, on l&apos;ajoutera ici pour les suivants.
              </p>
              <Link href="/contact" className="btn btn-primary">
                Nous écrire
              </Link>
            </div>
          )}

          <div className="faq-cta">
            <div>
              <h2 className="faq-cta-title">Vous ne trouvez pas votre réponse ?</h2>
              <p className="faq-cta-text">
                Le plus simple reste de venir nous voir un mercredi soir, pendant la
                distribution.
              </p>
            </div>
            <Link href="/contact" className="btn btn-primary btn-lg">
              Contactez-nous
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
