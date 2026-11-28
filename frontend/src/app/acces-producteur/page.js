'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import { dayMonthYearLong } from '../../lib/format';
import '../../styles/public/become-producer.css';
import '../../styles/public/producer-access.css';

const FARM_CLAIM_MAX = 500;
const ROLES_SANS_DEMANDE = ['ADMIN', 'PRODUCER'];

function Notice({ children }) {
  return (
    <div className="notice-band">
      <span className="notice-band-dot" aria-hidden="true" />
      <p className="notice-band-text">{children}</p>
    </div>
  );
}

export default function ProducerAccessPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { showError } = useModal();

  const [request, setRequest] = useState(undefined);
  const [loadError, setLoadError] = useState('');
  const [farmClaim, setFarmClaim] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const mustRead = isAuthenticated && user.emailVerified && !ROLES_SANS_DEMANDE.includes(user.role);

  const loadRequest = useCallback(() => api.producerAccessRequests.getMine()
    .then((data) => {
      setRequest(data.data.request);
      setLoadError('');
    })
    .catch((error) => setLoadError(error.message)), []);

  useEffect(() => {
    if (mustRead) loadRequest();
  }, [mustRead, loadRequest]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const claim = farmClaim.trim();
    if (!claim) {
      setFieldError('Indiquez la ferme que vous représentez');
      return;
    }

    setSending(true);
    try {
      const response = await api.producerAccessRequests.submit(claim);
      setConfirmation(response.message);
      setFarmClaim('');
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      // Le serveur a pu refuser pour une demande déjà en cours : on relit l'état.
      await loadRequest();
      setSending(false);
    }
  };

  const renderPanel = () => {
    if (authLoading || (mustRead && request === undefined && !loadError)) {
      return <p className="access-text">Chargement…</p>;
    }

    if (!isAuthenticated) {
      return (
        <>
          <p className="access-text">
            La demande se fait depuis votre compte. Connectez-vous, ou créez-en un et
            confirmez votre adresse email.
          </p>
          <div className="access-actions">
            <Link href="/auth/login?redirect=/acces-producteur" className="btn btn-primary btn-lg">Se connecter</Link>
            <Link href="/auth/register" className="btn btn-secondary btn-lg">Créer un compte</Link>
          </div>
        </>
      );
    }

    if (user.role === 'ADMIN') {
      return <Notice>Un compte administrateur ne peut pas être rattaché à une ferme.</Notice>;
    }

    if (user.role === 'PRODUCER' || request?.status === 'APPROVED') {
      return <Notice>Votre compte est déjà rattaché à une ferme.</Notice>;
    }

    if (!user.emailVerified) {
      return (
        <>
          <Notice>Confirmez votre adresse email avant de demander un accès producteur.</Notice>
          <div className="access-actions">
            <Link
              href={`/auth/renvoyer-confirmation?email=${encodeURIComponent(user.email)}`}
              className="btn btn-secondary btn-lg"
            >
              Renvoyer l&apos;email de confirmation
            </Link>
          </div>
        </>
      );
    }

    if (loadError) {
      return <Notice>{loadError}</Notice>;
    }

    if (request?.status === 'PENDING') {
      return (
        <>
          {confirmation ? (
            <div className="success-band" role="status">
              <span className="success-band-dot" aria-hidden="true" />
              <p className="success-band-text">{confirmation}</p>
            </div>
          ) : (
            <Notice>Vous avez déjà une demande en attente.</Notice>
          )}
          <p className="access-text">Déposée le {dayMonthYearLong(request.createdAt)} :</p>
          <p className="access-claim">{request.farmClaim}</p>
        </>
      );
    }

    if (request?.nextRequestAt) {
      const date = dayMonthYearLong(request.nextRequestAt);
      return (
        <Notice>
          {request.status === 'REVOKED'
            ? `Votre accès producteur a été retiré. Vous pourrez déposer une nouvelle demande à partir du ${date}.`
            : `Votre dernière demande a été refusée. Vous pourrez en déposer une nouvelle à partir du ${date}.`}
        </Notice>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="access-form" noValidate>
        <div className="field">
          <label htmlFor="farmClaim" className="field-label">
            La ferme que vous représentez <span className="field-required">*</span>
          </label>
          <textarea
            id="farmClaim"
            name="farmClaim"
            rows={4}
            maxLength={FARM_CLAIM_MAX}
            value={farmClaim}
            onChange={(event) => {
              setFarmClaim(event.target.value);
              if (fieldError) setFieldError('');
            }}
            className={`textarea ${fieldError ? 'input-error' : ''}`}
            aria-invalid={fieldError ? 'true' : undefined}
            aria-describedby={`farmClaim-count${fieldError ? ' farmClaim-error' : ''}`}
          />
          <span id="farmClaim-count" className="field-hint access-counter">
            {farmClaim.length} / {FARM_CLAIM_MAX} caractères
          </span>
          {fieldError && <span id="farmClaim-error" className="field-error">{fieldError}</span>}
        </div>

        <div className="access-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={sending}>
            {sending ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="producer-page">

      <p className="container producer-crosslink">
        Votre ferme ne travaille pas encore avec nous ?{' '}
        <Link href="/devenir-producteur">Proposez sa candidature.</Link>
      </p>

      <section className="container producer-hero access-hero">
        <div>
          <div className="eyebrow">Espace producteur · demande d&apos;accès</div>
          <h1 className="producer-title">Votre ferme livre déjà l&apos;AMAP ?</h1>
          <p className="producer-lede">
            Un administrateur vérifie votre demande, puis rattache votre compte à la fiche
            de votre ferme.
          </p>
        </div>
      </section>

      <section className="container access-body">
        <div className="access-panel">
          {renderPanel()}
        </div>
      </section>
    </div>
  );
}
