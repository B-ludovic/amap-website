'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { euro } from '../../lib/format';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import logger from '../../lib/logger';
import '../../styles/public/subscription-request.css';

/* Les paramètres d'URL sont des entrées comme les autres : « ?size=EXEMPLE »
   entrait tel quel dans l'état, le <select> retombait silencieusement sur sa
   première option — l'adhérent lisait donc « Petit panier » pendant que le
   formulaire portait une valeur inconnue — et la grille tarifaire, interrogée
   sur pricing.ANNUAL.EXEMPLE, ne renvoyait rien : tout le récapitulatif
   s'affichait en « … ». On ne retient donc que les valeurs connues. */
const TYPES = ['ANNUAL', 'DISCOVERY'];
const SIZES = ['SMALL', 'LARGE'];

const readParam = (value, allowed, fallback) =>
  (allowed.includes(value) ? value : fallback);

function SubscriptionRequestPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess, showError } = useModal();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    type: readParam(searchParams.get('type'), TYPES, 'ANNUAL'),
    basketSize: readParam(searchParams.get('size'), SIZES, 'SMALL'),
    pricingType: 'NORMAL',
    paymentType: '',
    message: ''
  });

  /* Montants passés par euro() : la grille renvoie des flottants, et un grand
     panier annuel s'affichait « 1460.2 € » — point décimal anglais et centime
     tronqué. */
  const getPaymentBreakdown = (price, paymentType) => {
    if (paymentType === '2') {
      return `2 × ${euro(price / 2)}`;
    }
    if (paymentType === '4') {
      const q = Math.round(price / 4);
      return `3 × ${euro(q)} + 1 × ${euro(price - q * 3)}`;
    }
    return euro(price);
  };

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pricing, setPricing] = useState(null);

  // La grille tarifaire vient du serveur, jamais d'une copie locale : c'est la
  // même table qui calcule le prix du contrat et qui l'annonce ici.
  useEffect(() => {
    api.subscriptions.getPricing()
      .then((data) => setPricing(data.data.pricing))
      .catch((error) => logger.error('Erreur récupération grille tarifaire:', error));
  }, []);

  /* Vérifier si user connecté au chargement.

     Le garde attend que le contexte ait tranché. Sans authLoading, le premier
     rendu voit user à null — non pas parce que personne n'est connecté, mais
     parce que la vérification n'est pas revenue — et renvoie au login un adhérent
     parfaitement authentifié. Le défaut ne se voyait pas en navigation interne,
     où le contexte est déjà hydraté ; il frappait les arrivées directes :
     rafraîchir la page, coller l'URL, ouvrir dans un nouvel onglet. */
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      const pendingRequest = {
        type: formData.type,
        basketSize: formData.basketSize,
        pricingType: formData.pricingType,
        message: formData.message
      };
      sessionStorage.setItem('pendingSubscriptionRequest', JSON.stringify(pendingRequest));

      showError(
        'Connexion requise',
        'Vous devez être connecté pour faire une demande d\'abonnement. Vos choix seront sauvegardés.'
      );

      router.push('/auth/login?redirect=/demande-abonnement');
    }
  }, [authLoading, isAuthenticated]);

  // Récupérer les données sauvegardées si elles existent
  useEffect(() => {
    if (isAuthenticated) {
      const pendingRequest = sessionStorage.getItem('pendingSubscriptionRequest');
      if (pendingRequest) {
        try {
          const data = JSON.parse(pendingRequest);
          setFormData(prev => ({ ...prev, ...data }));
          sessionStorage.removeItem('pendingSubscriptionRequest');
          showSuccess('Données récupérées', 'Vous pouvez maintenant finaliser votre demande');
        } catch (error) {
          logger.error('Erreur récupération données:', error);
        }
      }
    }
  }, [isAuthenticated]);

  const currentSubscription = pricing?.[formData.type]?.[formData.basketSize] ?? null;
  const displayedPrice = currentSubscription
    ? (formData.pricingType === 'SOLIDARITY'
        ? currentSubscription.priceSolidarity
        : currentSubscription.price)
    : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};

    if (!formData.type) newErrors.type = 'Veuillez sélectionner un type d\'abonnement';
    if (!formData.basketSize) newErrors.basketSize = 'Veuillez sélectionner une taille de panier';
    if (!formData.pricingType) newErrors.pricingType = 'Veuillez sélectionner un type de tarification';
    if (!formData.paymentType) newErrors.paymentType = 'Veuillez choisir une modalité de paiement';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.paymentType) {
        showError(
          'Modalité de paiement requise',
          'Veuillez choisir une modalité de paiement dans le récapitulatif avant d\'envoyer votre demande.'
        );
      }
      return;
    }

    try {
      setLoading(true);

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
      <div className="subrequest-page">
        <div className="container">
          <div className="subrequest-done">
            <p className="eyebrow">Demande enregistrée</p>
            <h1 className="subrequest-title">C’est envoyé.</h1>
            <p className="subrequest-lede">
              Nous avons bien reçu votre demande d’abonnement. L’équipe vous recontacte
              par email ou par téléphone pour finaliser votre inscription.
            </p>

            <ol className="numbered-steps numbered-steps-ruled subrequest-done-steps">
              <li className="numbered-step">
                <span className="numbered-step-number">01</span>
                <span className="numbered-step-text">Nous étudions votre demande, sous 48 heures.</span>
              </li>
              <li className="numbered-step">
                <span className="numbered-step-number">02</span>
                <span className="numbered-step-text">Nous vous contactons pour valider les informations.</span>
              </li>
              <li className="numbered-step">
                <span className="numbered-step-number">03</span>
                <span className="numbered-step-text">Vous remettez votre règlement par chèque.</span>
              </li>
              <li className="numbered-step">
                <span className="numbered-step-number">04</span>
                <span className="numbered-step-text">Votre abonnement est activé, et vous recevez votre premier panier le mercredi suivant.</span>
              </li>
            </ol>

            <div className="subrequest-done-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => router.push('/')}>
                Retour à l’accueil
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => router.push('/panier-semaine')}>
                Voir le panier de la semaine
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="subrequest-page">
      <div className="container">
        <div className="subrequest-head">
          <p className="eyebrow">Rejoindre l’AMAP</p>
          <h1 className="subrequest-title">Demande d’abonnement.</h1>
          <p className="subrequest-lede">
            Choisissez votre formule et votre modalité de règlement. Nous vous
            recontactons ensuite pour finaliser l’inscription — rien n’est prélevé
            à cette étape.
          </p>
        </div>

        <div className="subrequest-layout">
          <form onSubmit={handleSubmit} noValidate>
            <section className="subrequest-section">
              <h2 className="eyebrow">Votre formule</h2>

              <div className="subrequest-fields">
                <div className="field">
                  <label className="field-label" htmlFor="type">
                    Type d’abonnement <span className="field-required">*</span>
                  </label>
                  <select id="type" name="type" className="select" value={formData.type} onChange={handleChange}>
                    <option value="ANNUAL">Abonnement annuel</option>
                    <option value="DISCOVERY" disabled>Abonnement découverte (3 mois) — bientôt disponible</option>
                  </select>
                  {errors.type && <span className="field-error">{errors.type}</span>}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="basketSize">
                    Taille du panier <span className="field-required">*</span>
                  </label>
                  <select id="basketSize" name="basketSize" className="select" value={formData.basketSize} onChange={handleChange}>
                    <option value="SMALL">Petit panier — 2 à 4 kg</option>
                    <option value="LARGE">Grand panier — 6 à 8 kg</option>
                  </select>
                  {errors.basketSize && <span className="field-error">{errors.basketSize}</span>}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="pricingType">
                    Tarification <span className="field-required">*</span>
                  </label>
                  <select id="pricingType" name="pricingType" className="select" value={formData.pricingType} onChange={handleChange}>
                    <option value="NORMAL">Tarif normal — 100 %</option>
                    <option value="SOLIDARITY">Tarif solidaire — 20 %</option>
                  </select>
                  <span className="field-hint">
                    Votre demande est étudiée après réception du formulaire.
                  </span>
                  {errors.pricingType && <span className="field-error">{errors.pricingType}</span>}
                </div>
              </div>
            </section>

            {user && (
              <section className="subrequest-section">
                <h2 className="eyebrow">Vos informations</h2>

                <div className="split-list subrequest-identity">
                  <div className="split-row">
                    <span className="split-label">Nom</span>
                    <span className="split-value">{user.firstName} {user.lastName}</span>
                  </div>
                  <div className="split-row">
                    <span className="split-label">Email</span>
                    <span className="split-value">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="split-row">
                      <span className="split-label">Téléphone</span>
                      <span className="split-value">{user.phone}</span>
                    </div>
                  )}
                </div>

                <p className="field-hint subrequest-identity-note">
                  Ces informations viennent de votre compte. Pour les modifier,
                  rendez-vous dans <Link href="/compte" className="link-underline">Mon compte</Link>.
                </p>
              </section>
            )}

            <section className="subrequest-section">
              <h2 className="eyebrow">Message</h2>

              <div className="field">
                <label className="field-label" htmlFor="message">
                  Informations complémentaires, questions
                </label>
                <textarea
                  id="message"
                  name="message"
                  className="textarea"
                  value={formData.message}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Allergies, préférences, disponibilités…"
                />
              </div>
            </section>

            <div className="subrequest-submit-zone">
              <button type="submit" className="form-submit" disabled={loading}>
                {loading ? 'Envoi en cours…' : 'Envoyer ma demande'}
              </button>
              <p className="form-note">
                Les champs marqués d’une astérisque sont obligatoires. Vos données servent
                uniquement au traitement de votre demande d’abonnement.
              </p>
            </div>
          </form>

          {/* La colonne ne garde que ce qui sert pendant la saisie : le
              récapitulatif, qui recalcule le prix à chaque choix, et la carte
              qui répond à ce prix. Le contexte à lire une fois — distribution
              et prochaines étapes — descend sous le formulaire. C'est ce qui
              permet à l'aside entier de coller, comme sur la FAQ et les
              mentions légales : un aside plus haut que la fenêtre n'a aucune
              amplitude et ne colle jamais. */}
          <aside className="subrequest-side">
            <div className="side-card">
              <div className="side-card-head">
                <h2 className="side-card-title">Récapitulatif</h2>
              </div>
              <div className="side-card-body">
                <div className="side-block">
                  <div className="split-list">
                    <div className="split-row">
                      <span className="split-label">Formule</span>
                      <span className="split-value">{currentSubscription?.name ?? '—'}</span>
                    </div>
                    <div className="split-row">
                      <span className="split-label">Poids</span>
                      <span className="split-value">{currentSubscription?.weight ?? '—'}</span>
                    </div>
                    <div className="split-row">
                      <span className="split-label">Livraisons</span>
                      <span className="split-value">
                        {currentSubscription ? `${currentSubscription.weeks} paniers` : '—'}
                      </span>
                    </div>
                    <div className="split-row subrequest-price-row">
                      <span className="split-label">
                        {formData.pricingType === 'SOLIDARITY' ? 'Tarif solidaire' : 'Tarif normal'}
                      </span>
                      <span className="split-value">
                        {displayedPrice !== null ? euro(displayedPrice) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="side-block">
                  <p className="side-block-label">Modalité de règlement</p>
                  <select
                    id="paymentType"
                    name="paymentType"
                    className="select"
                    value={formData.paymentType}
                    onChange={handleChange}
                    aria-label="Modalité de règlement"
                  >
                    <option value="" disabled>Choisissez une modalité *</option>
                    <option value="1">1 chèque — règlement intégral</option>
                    <option value="2">2 chèques — 2 mois d’intervalle</option>
                    <option value="4">4 chèques — 2 mois d’intervalle</option>
                  </select>
                  {errors.paymentType && <span className="field-error">{errors.paymentType}</span>}
                  {displayedPrice !== null && formData.paymentType && (
                    <p className="subrequest-breakdown">
                      {getPaymentBreakdown(displayedPrice, formData.paymentType)}
                    </p>
                  )}
                </div>

                <div className="side-block">
                  {/* Insécables autour des guillemets : sans elles, le chevron
                      fermant se retrouve seul en début de ligne, la colonne
                      étant étroite. */}
                  <p className="subrequest-note">
                    Le règlement se fait après validation de votre demande, par chèque
                    à l’ordre de «&nbsp;Aux P’tits Pois&nbsp;».
                  </p>
                </div>
              </div>
            </div>

            {/* Carte forêt, posée juste sous le prix : c'est là que naît
                l'objection qu'elle désamorce. Même rôle que sur le panier
                hebdomadaire, le contact et la FAQ — une question anticipée,
                une sortie. */}
            <div className="forest-card subrequest-solidarity">
              <p className="eyebrow">Ce montant vous arrête ?</p>
              <p className="forest-card-text">
                En partenariat avec le Secours Catholique, le tarif solidaire ramène
                votre part à 20 % du prix. Sans dossier lourd, et sans aucune
                distinction le jour de la distribution.
              </p>
              <Link href="/contact" className="forest-card-link">
                Nous en parler
              </Link>
            </div>
          </aside>
        </div>

        {/* Contexte à lire une fois, sous le formulaire : la distribution et la
            suite du parcours ne servent pas à remplir les champs. */}
        <section className="subrequest-context">
          <div>
            <h2 className="eyebrow">La distribution</h2>
            <p className="subrequest-info-text">Chaque mercredi, de 18h15 à 19h15.</p>
            <p className="subrequest-info-text">
              Vous composez vous-même votre panier parmi les légumes disponibles selon
              votre formule, à la Paroisse Saint François de Sales, à Clamart.
            </p>
          </div>

          <div>
            <h2 className="eyebrow">Ce qui se passe ensuite</h2>
            <ol className="numbered-steps numbered-steps-ruled">
              <li className="numbered-step">
                <span className="numbered-step-number">01</span>
                <span className="numbered-step-text">Validation de votre demande</span>
              </li>
              <li className="numbered-step">
                <span className="numbered-step-number">02</span>
                <span className="numbered-step-text">Contact par email ou téléphone</span>
              </li>
              <li className="numbered-step">
                <span className="numbered-step-number">03</span>
                <span className="numbered-step-text">Règlement de l’abonnement</span>
              </li>
              <li className="numbered-step">
                <span className="numbered-step-number">04</span>
                <span className="numbered-step-text">Activation et premier panier</span>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SubscriptionRequestPage />
    </Suspense>
  );
}
