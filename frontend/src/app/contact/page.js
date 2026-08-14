'use client';

import { useState } from 'react';
import Link from 'next/link';
import '../../styles/public/contact.css';

// Suggestions de sujet : elles remplissent le champ, qui reste libre.
const TOPICS = [
  'Question sur les abonnements',
  'Absence ou semaine de pause',
  'Tarif solidaire',
  'Devenir bénévole'
];

const EMPTY_FORM = { name: '', email: '', subject: '', message: '' };

export default function ContactPage() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('editing'); // 'editing' | 'sending' | 'sent'
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const next = {};
    if (!formData.name.trim()) next.name = 'Nom requis';
    if (!formData.email.trim()) next.email = 'Email requis';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) next.email = 'Email invalide';
    if (!formData.subject.trim()) next.subject = 'Sujet requis';
    if (!formData.message.trim()) next.message = 'Message requis';
    else if (formData.message.trim().length < 10) {
      next.message = 'Message trop court pour qu\'on puisse répondre';
    }
    return next;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const pickTopic = (label) => {
    setFormData(prev => ({ ...prev, subject: label }));
    setErrors(prev => {
      if (!prev.subject) return prev;
      const next = { ...prev };
      delete next.subject;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setServerError('');
      return;
    }

    setErrors({});
    setServerError('');
    setStatus('sending');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de l\'envoi');
      }

      setStatus('sent');
      setFormData(EMPTY_FORM);
    } catch (error) {
      setStatus('editing');
      setServerError(error.message || 'Une erreur est survenue. Veuillez réessayer.');
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setServerError('');
    setStatus('editing');
  };

  const errorCount = Object.keys(errors).length;
  const alertMessage = serverError || (
    errorCount === 1
      ? 'Un champ demande votre attention avant l\'envoi.'
      : `${errorCount} champs demandent votre attention avant l'envoi.`
  );

  return (
    <div className="contact-page">
      <section className="contact-hero">
        <div className="eyebrow">Nous écrire</div>
        <h1 className="contact-title">Une question, une absence, une idée ?</h1>
        <p className="contact-lede">
          L&apos;AMAP est tenue par des bénévoles adhérents. Nous lisons tout et répondons
          sous 48 heures — un peu plus pendant les vacances scolaires.
        </p>
      </section>

      <section className="contact-body">
        <div className="contact-main">
          {status === 'sent' ? (
            <div className="contact-sent" role="status" aria-live="polite">
              <div className="contact-sent-badge">
                <span className="contact-sent-dot" aria-hidden="true" />
                <span className="contact-sent-label">Message envoyé</span>
              </div>
              <h2 className="contact-sent-title">C&apos;est parti, on vous lit.</h2>
              <p className="contact-sent-text">
                Votre message est arrivé dans la boîte du collectif. Un bénévole vous répond
                sous 48 heures à l&apos;adresse que vous avez indiquée.
              </p>
              <div className="contact-sent-actions">
                <Link href="/" className="contact-sent-home">Retour à l&apos;accueil</Link>
                <button type="button" className="contact-sent-again" onClick={resetForm}>
                  Écrire un autre message
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="contact-form-title">Envoyez-nous un message</h2>
              <p className="contact-form-lede">
                Les quatre champs sont nécessaires pour pouvoir vous répondre.
              </p>

              {(errorCount > 0 || serverError) && (
                <div className="contact-alert" role="alert" aria-live="assertive">
                  <span className="contact-alert-dot" aria-hidden="true" />
                  <span className="contact-alert-text">{alertMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="contact-form" noValidate>
                <div className="contact-row">
                  <div className="contact-field">
                    <label htmlFor="name" className="contact-label">
                      Nom complet <span className="contact-required" aria-label="obligatoire">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className={`input ${errors.name ? 'input-error' : ''}`}
                      value={formData.name}
                      onChange={handleChange}
                      maxLength={100}
                      autoComplete="name"
                      disabled={status === 'sending'}
                      aria-invalid={errors.name ? 'true' : undefined}
                      aria-describedby={errors.name ? 'contact-name-error' : undefined}
                    />
                    {errors.name && (
                      <span id="contact-name-error" className="contact-error">{errors.name}</span>
                    )}
                  </div>

                  <div className="contact-field">
                    <label htmlFor="email" className="contact-label">
                      Email <span className="contact-required" aria-label="obligatoire">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="email"
                      id="email"
                      name="email"
                      className={`input ${errors.email ? 'input-error' : ''}`}
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="votre@email.com"
                      autoComplete="email"
                      disabled={status === 'sending'}
                      aria-invalid={errors.email ? 'true' : undefined}
                      aria-describedby={errors.email ? 'contact-email-error' : undefined}
                    />
                    {errors.email && (
                      <span id="contact-email-error" className="contact-error">{errors.email}</span>
                    )}
                  </div>
                </div>

                <div className="contact-field">
                  <label htmlFor="subject" className="contact-label">
                    Sujet <span className="contact-required" aria-label="obligatoire">*</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    className={`input ${errors.subject ? 'input-error' : ''}`}
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="Ex : question sur les abonnements"
                    maxLength={200}
                    disabled={status === 'sending'}
                    aria-invalid={errors.subject ? 'true' : undefined}
                    aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
                  />
                  {errors.subject && (
                    <span id="contact-subject-error" className="contact-error">{errors.subject}</span>
                  )}
                  <div className="contact-topics">
                    {TOPICS.map(topic => (
                      <button
                        key={topic}
                        type="button"
                        className="contact-topic"
                        onClick={() => pickTopic(topic)}
                        disabled={status === 'sending'}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="contact-field">
                  <label htmlFor="message" className="contact-label">
                    Message <span className="contact-required" aria-label="obligatoire">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    className={`textarea ${errors.message ? 'input-error' : ''}`}
                    value={formData.message}
                    onChange={handleChange}
                    rows={7}
                    maxLength={5000}
                    placeholder="Votre message…"
                    disabled={status === 'sending'}
                    aria-invalid={errors.message ? 'true' : undefined}
                    aria-describedby={errors.message ? 'contact-message-error' : undefined}
                  />
                  {errors.message && (
                    <span id="contact-message-error" className="contact-error">{errors.message}</span>
                  )}
                </div>

                <div className="contact-send">
                  <button type="submit" className="contact-submit" disabled={status === 'sending'}>
                    {status === 'sending' ? 'Envoi en cours…' : 'Envoyer le message'}
                  </button>
                  <p className="contact-privacy">
                    Vos coordonnées servent uniquement à vous répondre. Elles ne sont ni
                    revendues, ni utilisées pour la newsletter sans votre accord.
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>

        <aside className="contact-aside">
          <div className="contact-card">
            <div className="contact-card-head">
              <h2 className="contact-card-title">Nous joindre autrement</h2>
            </div>
            <div className="contact-card-body">
              <div className="contact-block">
                <div className="contact-block-label">Email</div>
                <a href="mailto:auxptitspois@gmail.com" className="contact-mail">
                  auxptitspois@gmail.com
                </a>
              </div>
              <div className="contact-block">
                <div className="contact-block-label">Sur place</div>
                <p className="contact-address">
                  Paroisse Saint François de Sales<br />
                  340 avenue du Général de Gaulle<br />
                  92140 Clamart
                </p>
                <p className="contact-address-note">
                  Le plus simple : venez nous voir pendant une distribution.
                </p>
              </div>
              <div className="contact-block">
                <div className="contact-block-label">Distribution</div>
                <p className="contact-address">
                  Chaque mercredi<br />
                  <span className="contact-hours-time">18h15 → 19h15</span>
                </p>
              </div>
            </div>
          </div>

          <div className="contact-faq">
            <div className="eyebrow">Avant d&apos;écrire</div>
            <p className="contact-faq-text">
              La FAQ regroupe les questions les plus fréquentes : pauses, tarif solidaire,
              panier non retiré, permanences.
            </p>
            <Link href="/faq" className="contact-faq-link">Consulter la FAQ</Link>
            <p className="contact-faq-note">
              La question la plus courante — comment poser une semaine de pause — se règle
              depuis votre espace adhérent.
            </p>
          </div>

          <div className="contact-social">
            <div className="eyebrow">Nous suivre</div>
            <div className="contact-social-list">
              <span className="contact-social-item">Facebook — bientôt disponible</span>
              <span className="contact-social-item">Instagram — bientôt disponible</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
