'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sprout, MapPin, Mail, Phone, MessageSquare, CheckCircle, Package, Heart, TrendingUp } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import '../../styles/public/become-producer.css';

export default function BecomeProducerPage() {
  const router = useRouter();
  const { showModal } = useModal();

  const [formData, setFormData] = useState({
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
    availability: ''
  });

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

    if (!validate()) {
      showModal('Veuillez corriger les erreurs du formulaire', 'error');
      return;
    }

    try {
      setLoading(true);

      await api.producerInquiries.submit(formData);

      setSubmitted(true);
      showModal('Candidature envoyée avec succès !', 'success');
    } catch (error) {
      showModal(
        error.response?.data?.message || 'Une erreur est survenue',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="become-producer-page">
        <div className="container">
          <div className="success-card">
            <div className="success-icon">
              <CheckCircle size={64} />
            </div>
            <h1>Candidature envoyée !</h1>
            <p className="success-message">
              Merci pour votre intérêt à rejoindre le réseau Aux P'tits Pois. 
              Nous avons bien reçu votre candidature et nous vous recontacterons 
              dans les plus brefs délais pour échanger sur votre projet.
            </p>

            <div className="next-steps">
              <h2>Prochaines étapes</h2>
              <ol>
                <li>Nous étudions votre candidature (sous 48h)</li>
                <li>Échange téléphonique pour mieux vous connaître</li>
                <li>Visite de votre exploitation si possible</li>
                <li>Validation et intégration au réseau</li>
                <li>Première livraison !</li>
              </ol>
            </div>

            <div className="success-actions">
              <button 
                className="btn btn-primary"
                onClick={() => router.push('/')}
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="become-producer-page">
      {/* Hero */}
      <section className="producer-hero">
        <div className="container">
          <div className="hero-content">
            <h1>Devenez producteur partenaire</h1>
            <p className="hero-subtitle">
              Rejoignez notre réseau de producteurs locaux et bio, 
              et bénéficiez de débouchés garantis pour vos productions.
            </p>
          </div>
        </div>
      </section>

      {/* Pourquoi nous rejoindre */}
      <section className="why-join">
        <div className="container">
          <h2 className="section-title">Pourquoi rejoindre Aux P'tits Pois ?</h2>
          
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">
                <TrendingUp size={32} />
              </div>
              <h3>Débouchés garantis</h3>
              <p>
                Vos productions sont écoulées chaque semaine auprès de nos adhérents. 
                Pas de gaspillage, pas d'invendus.
              </p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <Heart size={32} />
              </div>
              <h3>Prix justes</h3>
              <p>
                Des tarifs équitables qui valorisent votre travail et garantissent 
                la pérennité de votre exploitation.
              </p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <MapPin size={32} />
              </div>
              <h3>Circuit ultra-court</h3>
              <p>
                Livraison directe au point de retrait, à moins de 30 km. 
                Pas d'intermédiaires, contact direct avec les consommateurs.
              </p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <Package size={32} />
              </div>
              <h3>Planification facilitée</h3>
              <p>
                Commandes prévisibles qui vous permettent d'optimiser vos cultures 
                et votre gestion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Critères requis */}
      <section className="criteria-section">
        <div className="container">
          <h2 className="section-title">Les critères requis</h2>
          
          <div className="criteria-list">
            <div className="criteria-item">
              <div className="criteria-icon">
                <Sprout size={24} />
              </div>
              <div className="criteria-content">
                <h3>Agriculture biologique</h3>
                <p>
                  Exploitation certifiée AB ou en conversion bio. Nous privilégions 
                  les pratiques respectueuses de l'environnement.
                </p>
              </div>
            </div>

            <div className="criteria-item">
              <div className="criteria-icon">
                <MapPin size={24} />
              </div>
              <div className="criteria-content">
                <h3>Localisation</h3>
                <p>
                  Votre exploitation doit être située dans un rayon de 30 km maximum 
                  autour de notre point de retrait.
                </p>
              </div>
            </div>

            <div className="criteria-item">
              <div className="criteria-icon">
                <Package size={24} />
              </div>
              <div className="criteria-content">
                <h3>Production de saison</h3>
                <p>
                  Légumes, fruits, œufs, ou produits d'épicerie locaux. 
                  Productions variées au fil des saisons.
                </p>
              </div>
            </div>

            <div className="criteria-item">
              <div className="criteria-icon">
                <Heart size={24} />
              </div>
              <div className="criteria-content">
                <h3>Engagement</h3>
                <p>
                  Engagement sur au moins 1 an avec livraisons régulières. 
                  Respect de la charte de l'AMAP.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Témoignage */}
      <section className="testimonial-section">
        <div className="container">
          <div className="testimonial-card">
            <div className="testimonial-icon">
              <Sprout size={48} />
            </div>
            <blockquote>
              "Rejoindre Aux P'tits Pois a changé ma façon de travailler. Je sais exactement 
              ce que je dois produire, mes légumes sont valorisés à leur juste prix, et le contact 
              direct avec les adhérents est très enrichissant. C'est une vraie bouffée d'air frais !"
            </blockquote>
            <div className="testimonial-author">
              <strong>Simon</strong>
              <span>3 Parcelles - Producteur partenaire depuis 3 ans</span>
            </div>
          </div>
        </div>
      </section>

      {/* Formulaire */}
      <section className="form-section">
        <div className="container">
          <div className="form-header">
            <h2>Postulez dès maintenant</h2>
            <p>
              Remplissez ce formulaire pour nous faire part de votre intérêt. 
              Nous reviendrons vers vous rapidement.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="producer-form">
            {/* Informations personnelles */}
            <div className="form-section-card">
              <h3>
                <Mail size={20} />
                Vos coordonnées
              </h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">Prénom *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={errors.firstName ? 'input-error' : ''}
                    required
                  />
                  {errors.firstName && (
                    <span className="error-message">{errors.firstName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Nom *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={errors.lastName ? 'input-error' : ''}
                    required
                  />
                  {errors.lastName && (
                    <span className="error-message">{errors.lastName}</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={errors.email ? 'input-error' : ''}
                    required
                  />
                  {errors.email && (
                    <span className="error-message">{errors.email}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Téléphone *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="06 12 34 56 78"
                    className={errors.phone ? 'input-error' : ''}
                    required
                  />
                  {errors.phone && (
                    <span className="error-message">{errors.phone}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Exploitation */}
            <div className="form-section-card">
              <h3>
                <Sprout size={20} />
                Votre exploitation
              </h3>

              <div className="form-group">
                <label htmlFor="farmName">Nom de l'exploitation *</label>
                <input
                  type="text"
                  id="farmName"
                  name="farmName"
                  value={formData.farmName}
                  onChange={handleChange}
                  placeholder="Ex: Les Jardins de Marie"
                  className={errors.farmName ? 'input-error' : ''}
                  required
                />
                {errors.farmName && (
                  <span className="error-message">{errors.farmName}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="address">Adresse *</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Numéro et nom de rue"
                  className={errors.address ? 'input-error' : ''}
                  required
                />
                {errors.address && (
                  <span className="error-message">{errors.address}</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="postalCode">Code postal *</label>
                  <input
                    type="text"
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    placeholder="75001"
                    maxLength="5"
                    className={errors.postalCode ? 'input-error' : ''}
                    required
                  />
                  {errors.postalCode && (
                    <span className="error-message">{errors.postalCode}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="city">Ville *</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={errors.city ? 'input-error' : ''}
                    required
                  />
                  {errors.city && (
                    <span className="error-message">{errors.city}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="distance">Distance (km)</label>
                  <input
                    type="number"
                    id="distance"
                    name="distance"
                    value={formData.distance}
                    onChange={handleChange}
                    placeholder="15"
                    min="0"
                    max="50"
                  />
                  <small className="form-hint">
                    Distance approximative depuis notre point de retrait (optionnel)
                  </small>
                </div>
              </div>
            </div>

            {/* Production */}
            <div className="form-section-card">
              <h3>
                <Package size={20} />
                Votre production
              </h3>

              <div className="form-group">
                <label htmlFor="products">Types de produits *</label>
                <textarea
                  id="products"
                  name="products"
                  value={formData.products}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Ex: Légumes variés de saison, fruits rouges, œufs..."
                  className={errors.products ? 'input-error' : ''}
                  required
                />
                {errors.products && (
                  <span className="error-message">{errors.products}</span>
                )}
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isBio"
                    checked={formData.isBio}
                    onChange={handleChange}
                  />
                  <span>Mon exploitation est certifiée Agriculture Biologique</span>
                </label>
              </div>

              {formData.isBio && (
                <div className="form-group">
                  <label htmlFor="certifications">Certifications</label>
                  <input
                    type="text"
                    id="certifications"
                    name="certifications"
                    value={formData.certifications}
                    onChange={handleChange}
                    placeholder="Ex: AB, Nature & Progrès, Demeter..."
                  />
                </div>
              )}
            </div>

            {/* Message */}
            <div className="form-section-card">
              <h3>
                <MessageSquare size={20} />
                Parlez-nous de vous
              </h3>

              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="5"
                  placeholder="Présentez votre exploitation, votre démarche, vos motivations..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="availability">Disponibilités pour un rendez-vous</label>
                <input
                  type="text"
                  id="availability"
                  name="availability"
                  value={formData.availability}
                  onChange={handleChange}
                  placeholder="Ex: Disponible les matins en semaine"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block"
                disabled={loading}
              >
                {loading ? 'Envoi en cours...' : 'Envoyer ma candidature'}
              </button>
              <p className="form-notice">
                * Champs obligatoires. Vos données sont uniquement utilisées pour 
                le traitement de votre candidature.
              </p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}