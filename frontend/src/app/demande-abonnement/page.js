'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShoppingBasket, MessageSquare, CheckCircle, Heart, LogIn } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import '../../styles/public/subscription-request.css';


export default function SubscriptionRequestPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess, showError } = useModal();
  const { user, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    type: searchParams.get('type') || 'ANNUAL',
    basketSize: searchParams.get('size') || 'SMALL',
    pricingType: 'NORMAL',
    paymentType: '1',
    message: ''
  });

  const getPaymentBreakdown = (price, paymentType) => {
    if (paymentType === '2') {
      const half = (price / 2).toFixed(2);
      return `2 × ${half}€`;
    }
    if (paymentType === '4') {
      const q = Math.round(price / 4);
      const qLast = (price - q * 3).toFixed(2);
      return `3 × ${q}€ + 1 × ${qLast}€`;
    }
    return `${price}€`;
  };

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Vérifier si user connecté au chargement
  useEffect(() => {
    if (!isAuthenticated) {
      // Sauvegarder les données du formulaire
      const pendingRequest = {
        type: formData.type,
        basketSize: formData.basketSize,
        pricingType: formData.pricingType,
        message: formData.message
      };
      localStorage.setItem('pendingSubscriptionRequest', JSON.stringify(pendingRequest));
      
      showError(
        'Connexion requise',
        'Vous devez être connecté pour faire une demande d\'abonnement. Vos choix seront sauvegardés.'
      );
      
      // Rediriger vers login avec redirect
      router.push('/auth/login?redirect=/demande-abonnement');
    }
  }, [isAuthenticated]);

  // Récupérer les données sauvegardées si elles existent
  useEffect(() => {
    if (isAuthenticated) {
      const pendingRequest = localStorage.getItem('pendingSubscriptionRequest');
      if (pendingRequest) {
        try {
          const data = JSON.parse(pendingRequest);
          setFormData(prev => ({ ...prev, ...data }));
          localStorage.removeItem('pendingSubscriptionRequest');
          showSuccess('Données récupérées', 'Vous pouvez maintenant finaliser votre demande');
        } catch (error) {
          console.error('Erreur récupération données:', error);
        }
      }
    }
  }, [isAuthenticated]);

  const subscriptionInfo = {
    ANNUAL: {
      SMALL: { name: 'Annuel - Petit Panier', price: 931, priceSolidarity: 186.20, weight: '2-4 kg', weeks: 49 },
      LARGE: { name: 'Annuel - Grand Panier', price: 1460.20, priceSolidarity: 292.04, weight: '6-8 kg', weeks: 49 }
    },
    DISCOVERY: {
      SMALL: { name: 'Découverte - Petit Panier', price: 228, priceSolidarity: 45.60, weight: '2-4 kg', weeks: 12 },
      LARGE: { name: 'Découverte - Grand Panier', price: 357.60, priceSolidarity: 71.52, weight: '6-8 kg', weeks: 12 }
    }
  };

  const currentSubscription = subscriptionInfo[formData.type][formData.basketSize];

  const validate = () => {
    const newErrors = {};

    if (!formData.type) {
      newErrors.type = 'Type d\'abonnement requis';
    }

    if (!formData.basketSize) {
      newErrors.basketSize = 'Taille de panier requise';
    }

    if (!formData.pricingType) {
      newErrors.pricingType = 'Type de tarification requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    const newErrors = {};

    if (!formData.type) newErrors.type = 'Veuillez sélectionner un type d\'abonnement';
    if (!formData.basketSize) newErrors.basketSize = 'Veuillez sélectionner une taille de panier';
    if (!formData.pricingType) newErrors.pricingType = 'Veuillez sélectionner un type de tarification';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);

      // Appeler l'API (l'utilisateur est connecté, le backend récupère ses infos)
      await api.subscriptionRequests.submitRequest({
        type: formData.type,
        basketSize: formData.basketSize,
        pricingType: formData.pricingType,
        paymentType: formData.paymentType,
        message: formData.message
      });

      setSubmitted(true);
      showSuccess('Succès', 'Demande envoyée avec succès !');
    } catch (error) {
      showError(
        'Erreur',
        error.message || 'Une erreur est survenue lors de l\'envoi de votre demande'
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="subscription-request-page">
        <div className="container">
          <div className="success-card">
            <div className="success-icon">
              <CheckCircle size={64} />
            </div>
            <h1>Demande envoyée avec succès !</h1>
            <p className="success-message">
              Merci pour votre demande d'abonnement à Aux P'tits Pois. 
              Nous avons bien reçu votre formulaire et nous vous recontacterons 
              très prochainement par email ou téléphone pour finaliser votre inscription.
            </p>

            <div className="next-steps">
              <h2>Prochaines étapes</h2>
              <ol>
                <li>Nous étudions votre demande (sous 48h)</li>
                <li>Nous vous contactons pour valider les informations</li>
                <li>Vous effectuez le paiement (chèque, virement ou espèces)</li>
                <li>Votre abonnement est activé</li>
                <li>Vous recevez votre premier panier le mercredi suivant !</li>
              </ol>
            </div>

            <div className="success-actions">
              <button 
                className="btn btn-primary"
                onClick={() => router.push('/')}
              >
                Retour à l'accueil
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => router.push('/panier-semaine')}
              >
                Voir le panier de la semaine
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-request-page">
      <div className="container">
        {/* En-tête */}
        <div className="page-header">
          <h1>Demande d'abonnement</h1>
          <p className="page-subtitle">
            Remplissez ce formulaire et nous vous recontacterons pour finaliser votre inscription
          </p>
        </div>

        <div className="request-layout">
          {/* Formulaire */}
          <div className="request-form-container">
            <form onSubmit={handleSubmit} className="request-form">
              {/* Type d'abonnement */}
              <div className="form-section">
                <h2>
                  <ShoppingBasket size={24} />
                  Votre abonnement
                </h2>

                <div className="form-group">
                  <label htmlFor="type">Type d'abonnement *</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                  >
                    <option value="ANNUAL">Abonnement Annuel</option>
                    <option value="DISCOVERY" disabled>Abonnement Découverte (3 mois) — Bientôt disponible</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="basketSize">Taille du panier *</label>
                  <select
                    id="basketSize"
                    name="basketSize"
                    value={formData.basketSize}
                    onChange={handleChange}
                    required
                  >
                    <option value="SMALL">Petit panier (2-4 kg)</option>
                    <option value="LARGE">Grand panier (6-8 kg)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="pricingType">Tarification *</label>
                  <select
                    id="pricingType"
                    name="pricingType"
                    value={formData.pricingType}
                    onChange={handleChange}
                    required
                  >
                    <option value="NORMAL">Tarif normal (100%)</option>
                    <option value="SOLIDARITY">Tarif solidaire (20%)</option>
                  </select>
                  <small className="form-hint">
                    Le tarif solidaire est proposé en partenariat avec le Secours Catholique. 
                    Votre demande sera étudiée après réception du formulaire.
                  </small>
                </div>
              </div>

              {/* Informations utilisateur (lecture seule) */}
              {user && (
                <div className="form-section user-info-section">
                  <h2>
                    <CheckCircle size={24} />
                    Vos informations
                  </h2>
                  <div className="user-info-display">
                    <p><strong>Nom :</strong> {user.firstName} {user.lastName}</p>
                    <p><strong>Email :</strong> {user.email}</p>
                    {user.phone && <p><strong>Téléphone :</strong> {user.phone}</p>}
                  </div>
                  <small className="form-hint">
                    Ces informations proviennent de votre compte. Pour les modifier, 
                    rendez-vous dans <a href="/compte">Mon Compte</a>.
                  </small>
                </div>
              )}

              {/* Message */}
              <div className="form-section">
                <h2>
                  <MessageSquare size={24} />
                  Message (optionnel)
                </h2>

                <div className="form-group">
                  <label htmlFor="message">
                    Informations complémentaires, questions...
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Ex: Allergies, préférences, disponibilités..."
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
                  {loading ? 'Envoi en cours...' : 'Envoyer ma demande'}
                </button>
                <p className="form-notice">
                  * Champs obligatoires. Vos données sont uniquement utilisées pour 
                  le traitement de votre demande d'abonnement.
                </p>
              </div>
            </form>
          </div>

          {/* Récapitulatif */}
          <div className="request-summary">
            <div className="summary-card">
              <h3>Récapitulatif</h3>

              <div className="summary-item">
                <span className="summary-label">Abonnement</span>
                <span className="summary-value">{currentSubscription.name}</span>
              </div>

              <div className="summary-item">
                <span className="summary-label">Poids</span>
                <span className="summary-value">{currentSubscription.weight}</span>
              </div>

              {currentSubscription.duration && (
                <div className="summary-item">
                  <span className="summary-label">Durée</span>
                  <span className="summary-value">{currentSubscription.duration}</span>
                </div>
              )}

              <div className="summary-divider" />

              <div className="summary-item">
                <span className="summary-label">Tarif normal</span>
                <span className="summary-value price">{currentSubscription.price}€</span>
              </div>

              {formData.pricingType === 'SOLIDARITY' && (
                <div className="summary-item solidarity">
                  <span className="summary-label">
                    <Heart size={16} />
                    Tarif solidaire
                  </span>
                  <span className="summary-value price">{currentSubscription.priceSolidarity}€</span>
                </div>
              )}

              <div className="summary-payment">
                <label className="summary-payment-label">Modalité de paiement</label>
                <select
                  className="summary-payment-select"
                  name="paymentType"
                  value={formData.paymentType}
                  onChange={handleChange}
                >
                  <option value="1">1 chèque — paiement intégral</option>
                  <option value="2">2 chèques — 2 mois d'intervalle</option>
                  <option value="4">4 chèques — 2 mois d'intervalle</option>
                </select>
                <div className="summary-payment-detail">
                  {getPaymentBreakdown(
                    formData.pricingType === 'SOLIDARITY'
                      ? currentSubscription.priceSolidarity
                      : currentSubscription.price,
                    formData.paymentType
                  )}
                </div>
              </div>

              <div className="summary-note">
                Le paiement se fera après validation de votre demande, par chèque à l'ordre de « Aux P'tits Pois ».
              </div>
            </div>

            <div className="info-card">
              <h4>Distribution</h4>
              <p>
                <strong>Chaque mercredi</strong><br />
                18h15 - 19h15
              </p>
              <p className="info-detail">
                Vous composez vous-même votre panier parmi les légumes disponibles 
                selon votre formule.
              </p>
            </div>

            <div className="info-card">
              <h4>Prochaines étapes</h4>
              <ol className="steps-list">
                <li>Validation de votre demande</li>
                <li>Contact par email/téléphone</li>
                <li>Paiement de l'abonnement</li>
                <li>Activation et premier panier !</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}