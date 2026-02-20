'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Mail, MapPin, Clock, Leaf } from 'lucide-react';
import '../../styles/public/contact.css';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState(''); // 'sending', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contact', {
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

      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message);
    }
  };

  return (
    <div className="contact-page">
      <div className="contact-container">
        {/* En-tête */}
        <div className="contact-header">
          <h1>Contactez-nous</h1>
          <p>Une question ? Une suggestion ? N'hésitez pas à nous écrire !</p>
        </div>

        <div className="contact-content">
          {/* Formulaire */}
          <div className="contact-form-section">
            <h2>Envoyez-nous un message</h2>

            {status === 'success' && (
              <div className="alert alert-success">
                <CheckCircle size={18} /> Votre message a été envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.
              </div>
            )}

            {status === 'error' && (
              <div className="alert alert-error">
                <XCircle size={18} /> {errorMessage || 'Une erreur est survenue. Veuillez réessayer.'}
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label htmlFor="name">Nom complet *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={status === 'sending'}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={status === 'sending'}
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Sujet *</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  disabled={status === 'sending'}
                  placeholder="Ex: Question sur les abonnements"
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  disabled={status === 'sending'}
                  rows="6"
                  placeholder="Votre message..."
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-large"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Envoi en cours...' : 'Envoyer le message'}
              </button>
            </form>
          </div>

          {/* Informations de contact */}
          <div className="contact-info-section">
            <h2>Informations de contact</h2>

            <div className="info-card">
              <div className="info-icon"><Mail size={24} /></div>
              <div className="info-content">
                <h3>Email</h3>
                <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon"><MapPin size={24} /></div>
              <div className="info-content">
                <h3>Adresse</h3>
                <p>
                  [Adresse du point de retrait]<br />
                  [Code postal] [Ville]
                </p>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon"><Clock size={24} /></div>
              <div className="info-content">
                <h3>Horaires de distribution</h3>
                <p>
                  Chaque mercredi<br />
                  18h00 - 19h30
                </p>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon"><Leaf size={24} /></div>
              <div className="info-content">
                <h3>Suivez-nous</h3>
                <div className="social-links">
                  <a href="#" target="_blank" rel="noopener noreferrer">Facebook</a>
                  <a href="#" target="_blank" rel="noopener noreferrer">Instagram</a>
                </div>
              </div>
            </div>

            <div className="faq-link">
              <p>
                Consultez notre <a href="/faq">FAQ</a> pour des réponses rapides aux questions fréquentes. (Bientôt disponible)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}