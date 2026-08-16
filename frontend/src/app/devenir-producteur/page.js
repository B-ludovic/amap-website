'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import { CONTACT_EMAIL } from '../../constants/association';
import '../../styles/public/become-producer.css';

const BENEFITS = [
  {
    title: 'Débouchés garantis',
    text: "Vos productions sont écoulées chaque semaine auprès des adhérents. Pas de gaspillage, pas d'invendus.",
  },
  {
    title: 'Prix justes',
    text: "Des tarifs équitables, discutés en assemblée, qui valorisent votre travail et la pérennité de l'exploitation.",
  },
  {
    title: 'Circuit ultra-court',
    text: 'Livraison directe au point de retrait, à moins de 30 km. Aucun intermédiaire, contact direct avec les mangeurs.',
  },
  {
    title: 'Planification facilitée',
    text: 'Des commandes prévisibles, connues avant les semis, qui vous laissent optimiser vos cultures.',
  },
  {
    title: 'Trésorerie sécurisée',
    text: "Les adhérents s'engagent financièrement à l'avance sur la saison. Vous gagnez de la visibilité et un apport de trésorerie.",
  },
  {
    title: 'Gestion allégée',
    text: "L'équipe de bénévoles gère les abonnements, les paiements et la communication. Vous restez sur votre métier.",
  },
];

const CRITERIA = [
  {
    title: 'Agriculture biologique',
    text: 'Exploitation certifiée AB ou en conversion. Nous privilégions les pratiques respectueuses de l\'environnement.',
  },
  {
    title: 'Localisation',
    text: 'Un rayon de 30 km maximum autour du point de retrait, à Clamart.',
  },
  {
    title: 'Production de saison',
    text: 'Légumes, fruits, œufs ou épicerie locale. Des productions variées au fil des saisons.',
  },
  {
    title: 'Engagement',
    text: "Un an minimum, avec des livraisons régulières, et le respect de la charte de l'AMAP.",
  },
];

const NEXT_STEPS = [
  'Étude de votre candidature — sous 48 h',
  'Échange téléphonique pour mieux vous connaître',
  "Visite de votre exploitation, si c'est possible",
  'Validation et intégration au réseau',
  'Première livraison',
];

const FORM_STEPS = ['Vos coordonnées', 'Votre exploitation', 'Votre production', 'Parlez-nous de vous'];

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  farmName: '',
  address: '',
  city: '',
  postalCode: '',
  distance: '',
  products: '',
  isBio: false,
  certifications: '',
  message: '',
  availability: '',
};

export default function BecomeProducerPage() {
  const { showError } = useModal();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Prénom requis';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Nom requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Téléphone requis';
    } else if (!/^[0-9\s\-\+\(\)]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Numéro invalide';
    }

    if (!formData.farmName.trim()) {
      newErrors.farmName = 'Nom de l\'exploitation requis';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Adresse requise';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'Ville requise';
    }

    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Code postal requis';
    } else if (!/^[0-9]{5}$/.test(formData.postalCode)) {
      newErrors.postalCode = 'Code postal invalide (5 chiffres)';
    }

    if (!formData.products.trim()) {
      newErrors.products = 'Types de produits requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Le récapitulatif d'erreurs s'affiche en bas du formulaire, pas en modale.
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);

      // Préparer les données en convertissant les champs numériques
      const dataToSubmit = {
        ...formData,
        distance: formData.distance ? parseInt(formData.distance) : null,
        certifications: formData.certifications || null,
        message: formData.message || null,
        availability: formData.availability || null
      };

      await api.producerInquiries.submit(dataToSubmit);

      setSubmitted(true);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setLoading(false);
    setSubmitted(false);
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  const fieldProps = (name, extra = {}) => ({
    id: name,
    name,
    value: formData[name],
    onChange: handleChange,
    className: `input ${errors[name] ? 'input-error' : ''}${extra.mono ? ' input-mono' : ''}`,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  if (submitted) {
    return (
      <div className="producer-page">
        <section className="container producer-done">
          <div>
            <div className="pill-success producer-badge">
              <span className="pill-success-dot" aria-hidden="true" />
              <span className="pill-success-label">Candidature reçue</span>
            </div>
            <h1 className="producer-done-title">Merci — on vous rappelle.</h1>
            <p className="producer-done-lede">
              Votre candidature est arrivée. Un bénévole du collectif la lit dans les
              quarante-huit heures et vous écrit pour convenir d&apos;un premier échange.
            </p>
            <div className="producer-done-actions">
              <Link href="/" className="btn btn-primary btn-lg">Retour à l&apos;accueil</Link>
              <button type="button" className="btn btn-secondary btn-lg" onClick={handleReset}>
                Envoyer une autre candidature
              </button>
            </div>
          </div>

          <div className="producer-steps-card">
            <div className="eyebrow">Prochaines étapes</div>
            <ol className="numbered-steps numbered-steps-flush">
              {NEXT_STEPS.map((step, i) => (
                <li className="numbered-step" key={step}>
                  <span className="numbered-step-number">{String(i + 1).padStart(2, '0')}</span>
                  <span className="numbered-step-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="producer-page">

      {/* Hero */}
      <section className="container producer-hero">
        <div>
          <div className="eyebrow">Réseau producteurs · candidature ouverte</div>
          <h1 className="producer-title">Vous semez, on garantit l&apos;écoulement.</h1>
          <p className="producer-lede">
            Nos adhérents s&apos;engagent et paient à l&apos;avance sur une saison complète.
            Pour vous, cela veut dire des volumes connus, une trésorerie avancée et zéro
            invendu.
          </p>
        </div>

        <dl className="facts">
          <div className="fact">
            <dt className="fact-value">30 km</dt>
            <dd className="fact-label">rayon maximum autour du point de retrait</dd>
          </div>
          <div className="fact">
            <dt className="fact-value">48 h</dt>
            <dd className="fact-label">délai de réponse à une candidature</dd>
          </div>
          <div className="fact">
            <dt className="fact-value">1 an</dt>
            <dd className="fact-label">durée d&apos;engagement minimale, de part et d&apos;autre</dd>
          </div>
        </dl>
      </section>

      {/* Pourquoi nous rejoindre */}
      <section className="container producer-why">
        <div className="producer-why-head">
          <div className="eyebrow">Pourquoi nous rejoindre</div>
          <h2 className="section-display">Six raisons, et aucune n&apos;est du marketing.</h2>
        </div>

        <div className="producer-benefits">
          {BENEFITS.map((benefit, i) => (
            <article className="producer-benefit" key={benefit.title}>
              <div className="producer-benefit-number">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="producer-benefit-title">{benefit.title}</h3>
              <p className="producer-benefit-text">{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Les critères */}
      <section className="band-sand">
        <div className="container producer-criteria">
          <div>
            <div className="eyebrow">Les critères requis</div>
            <h2 className="section-display">Quatre conditions, pas de dossier à monter.</h2>
            <p className="producer-criteria-lede">
              Si l&apos;une d&apos;elles vous semble limite, candidatez quand même : on en
              discute au téléphone.
            </p>
          </div>

          <dl className="producer-criteria-list">
            {CRITERIA.map(item => (
              <div className="producer-criterion" key={item.title}>
                <dt className="producer-criterion-title">{item.title}</dt>
                <dd className="producer-criterion-text">{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Témoignage */}
      <section className="band-forest">
        <div className="container producer-quote">
          <div>
            <div className="eyebrow eyebrow-on-forest">Un partenaire, trois ans plus tard</div>
            <blockquote className="producer-quote-text">
              « Je sais exactement ce que je dois produire, mes légumes sont valorisés à
              leur juste prix, et le contact direct avec les adhérents est très
              enrichissant. »
            </blockquote>
            <div className="producer-quote-author">
              <span className="producer-quote-name">Simon</span>
              <span className="producer-quote-farm">3 Parcelles · partenaire depuis 3 ans</span>
            </div>
          </div>

          <div className="producer-quote-photo">
            <Image
              src="/images/ferme-maraichage.webp"
              alt="Maraîchage de plein champ"
              width={1078}
              height={1076}
            />
          </div>
        </div>
      </section>

      {/* Candidature */}
      <section id="candidature" className="container producer-apply">
        <aside className="producer-apply-side">
          <div className="eyebrow">La candidature</div>
          <h2 className="section-display producer-apply-title">Postulez dès maintenant.</h2>
          <p className="producer-apply-lede">
            Cinq minutes, quatre blocs. Nous revenons vers vous sous 48 heures pour un
            premier échange — rien n&apos;est engagé avant.
          </p>

          <ol className="producer-summary">
            {FORM_STEPS.map((step, i) => (
              <li className="producer-summary-row" key={step}>
                <span className="producer-summary-number">{String(i + 1).padStart(2, '0')}</span>
                <span className="producer-summary-text">{step}</span>
              </li>
            ))}
          </ol>

          <a href={`mailto:${CONTACT_EMAIL}`} className="producer-apply-mail">
            {CONTACT_EMAIL}
          </a>
        </aside>

        <form onSubmit={handleSubmit} className="producer-form" noValidate>

          <fieldset className="producer-fieldset">
            <legend className="producer-legend">01 · Vos coordonnées</legend>
            <div className="producer-grid-2">
              <div className="field producer-field">
                <label htmlFor="firstName" className="field-label">
                  Prénom <span className="field-required">*</span>
                </label>
                <input type="text" autoComplete="given-name" {...fieldProps('firstName')} />
                {errors.firstName && <span id="firstName-error" className="field-error">{errors.firstName}</span>}
              </div>

              <div className="field producer-field">
                <label htmlFor="lastName" className="field-label">
                  Nom <span className="field-required">*</span>
                </label>
                <input type="text" autoComplete="family-name" {...fieldProps('lastName')} />
                {errors.lastName && <span id="lastName-error" className="field-error">{errors.lastName}</span>}
              </div>

              <div className="field producer-field">
                <label htmlFor="email" className="field-label">
                  Email <span className="field-required">*</span>
                </label>
                <input type="text" inputMode="email" autoComplete="email" {...fieldProps('email')} />
                {errors.email && <span id="email-error" className="field-error">{errors.email}</span>}
              </div>

              <div className="field producer-field">
                <label htmlFor="phone" className="field-label">
                  Téléphone <span className="field-required">*</span>
                </label>
                <input type="tel" autoComplete="tel" placeholder="06 12 34 56 78" {...fieldProps('phone', { mono: true })} />
                {errors.phone && <span id="phone-error" className="field-error">{errors.phone}</span>}
              </div>
            </div>
          </fieldset>

          <fieldset className="producer-fieldset">
            <legend className="producer-legend">02 · Votre exploitation</legend>
            <div className="producer-stack">
              <div className="field producer-field">
                <label htmlFor="farmName" className="field-label">
                  Nom de l&apos;exploitation <span className="field-required">*</span>
                </label>
                <input type="text" placeholder="Les Jardins de Marie" {...fieldProps('farmName')} />
                {errors.farmName && <span id="farmName-error" className="field-error">{errors.farmName}</span>}
              </div>

              <div className="field producer-field">
                <label htmlFor="address" className="field-label">
                  Adresse <span className="field-required">*</span>
                </label>
                <input type="text" autoComplete="street-address" placeholder="Numéro et nom de rue" {...fieldProps('address')} />
                {errors.address && <span id="address-error" className="field-error">{errors.address}</span>}
              </div>

              <div className="producer-grid-address">
                <div className="field producer-field">
                  <label htmlFor="postalCode" className="field-label">
                    Code postal <span className="field-required">*</span>
                  </label>
                  <input type="text" maxLength={5} autoComplete="postal-code" placeholder="92140" {...fieldProps('postalCode', { mono: true })} />
                  {errors.postalCode && <span id="postalCode-error" className="field-error">{errors.postalCode}</span>}
                </div>

                <div className="field producer-field">
                  <label htmlFor="city" className="field-label">
                    Ville <span className="field-required">*</span>
                  </label>
                  <input type="text" autoComplete="address-level2" {...fieldProps('city')} />
                  {errors.city && <span id="city-error" className="field-error">{errors.city}</span>}
                </div>

                <div className="field producer-field">
                  <label htmlFor="distance" className="field-label">Distance (km)</label>
                  <input type="text" inputMode="numeric" placeholder="15" {...fieldProps('distance', { mono: true })} />
                  <span className="field-hint">Depuis le point de retrait — optionnel</span>
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="producer-fieldset">
            <legend className="producer-legend">03 · Votre production</legend>
            <div className="producer-stack">
              <div className="field producer-field">
                <label htmlFor="products" className="field-label">
                  Types de produits <span className="field-required">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Légumes variés de saison, fruits rouges, œufs…"
                  {...fieldProps('products')}
                  className={`textarea ${errors.products ? 'input-error' : ''}`}
                />
                {errors.products && <span id="products-error" className="field-error">{errors.products}</span>}
              </div>

              <label htmlFor="isBio" className="producer-check">
                <input
                  id="isBio"
                  name="isBio"
                  type="checkbox"
                  checked={formData.isBio}
                  onChange={handleChange}
                  className="producer-checkbox"
                />
                <span>Mon exploitation est certifiée Agriculture Biologique</span>
              </label>

              {formData.isBio && (
                <div className="field producer-field">
                  <label htmlFor="certifications" className="field-label">Certifications</label>
                  <input type="text" placeholder="AB, Nature &amp; Progrès, Demeter…" {...fieldProps('certifications')} />
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className="producer-fieldset">
            <legend className="producer-legend">04 · Parlez-nous de vous</legend>
            <div className="producer-stack">
              <div className="field producer-field">
                <label htmlFor="message" className="field-label">Message</label>
                <textarea
                  rows={5}
                  placeholder="Votre exploitation, votre démarche, vos motivations…"
                  {...fieldProps('message')}
                  className="textarea"
                />
              </div>

              <div className="field producer-field">
                <label htmlFor="availability" className="field-label">
                  Disponibilités pour un rendez-vous
                </label>
                <input type="text" placeholder="Disponible les matins en semaine" {...fieldProps('availability')} />
              </div>
            </div>
          </fieldset>

          {errorCount > 0 && (
            <div className="form-alert producer-alert" role="alert">
              <span className="form-alert-dot" aria-hidden="true" />
              <span className="form-alert-text">
                {errorCount === 1
                  ? 'Un champ demande votre attention avant l\'envoi.'
                  : `${errorCount} champs demandent votre attention avant l'envoi.`}
              </span>
            </div>
          )}

          <div className="producer-submit-zone">
            <button type="submit" className="form-submit" disabled={loading}>
              {loading ? 'Envoi en cours…' : 'Envoyer ma candidature'}
            </button>
            <p className="form-note producer-legal">
              Les champs marqués d&apos;une astérisque sont obligatoires. Vos données servent
              uniquement au traitement de votre candidature.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
