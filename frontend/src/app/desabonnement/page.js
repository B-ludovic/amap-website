'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader, MailX } from 'lucide-react';
import { newsletterPreferences } from '../../lib/api';
import '../../styles/public/auth.css';
import '../../styles/public/unsubscribe.css';

/* La page d'arrivée du lien « Me désabonner » d'un email.

   Elle s'ouvre sans session : le sceau que porte l'URL dit au serveur de qui il
   s'agit (voir backend/src/utils/unsubscribeToken.js). Personne n'a à retrouver
   son mot de passe pour partir.

   Le désabonnement n'a pas lieu à l'ouverture, mais au clic sur le bouton. Les
   antivirus d'entreprise et les aperçus de lien visitent les adresses d'un email
   avant que le message soit lu : un désabonnement déclenché par le simple
   affichage partirait sans que personne l'ait voulu. */

const STEPS = {
  CHECKING: 'checking',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',
  INVALID: 'invalid',
};

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const u = searchParams.get('u');
  const t = searchParams.get('t');

  const [step, setStep] = useState(STEPS.CHECKING);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!u || !t) {
      setStep(STEPS.INVALID);
      setError('Ce lien est incomplet. Ouvrez-le depuis l\'email que vous avez reçu.');
      return;
    }

    let cancelled = false;

    newsletterPreferences.status({ u, t })
      .then(({ data }) => {
        if (cancelled) return;
        setEmail(data.email);
        setStep(data.optIn ? STEPS.SUBSCRIBED : STEPS.UNSUBSCRIBED);
      })
      .catch((err) => {
        if (cancelled) return;
        setStep(STEPS.INVALID);
        setError(err.message);
      });

    return () => { cancelled = true; };
  }, [u, t]);

  /* Les deux gestes sont symétriques : même sceau, même écran, seul le sens
     change. On garde l'erreur affichée sous le bouton plutôt que de basculer
     toute la page — la personne doit pouvoir réessayer sans rouvrir son email. */
  const submit = useCallback(async (action, nextStep) => {
    setWorking(true);
    setError('');
    try {
      const { data } = await action({ u, t });
      setEmail(data.email);
      setStep(nextStep);
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }, [u, t]);

  if (step === STEPS.CHECKING) {
    return (
      <div className="auth-success-state">
        <div className="auth-loading-icon">
          <Loader size={64} />
        </div>
        <p>Vérification du lien…</p>
      </div>
    );
  }

  if (step === STEPS.INVALID) {
    return (
      <div className="auth-success-state">
        <div className="auth-error-icon">
          <XCircle size={64} />
        </div>
        <h1 className="auth-title">Lien invalide</h1>
        <p className="auth-description">{error}</p>
        <div className="auth-success-actions">
          <Link href="/contact" className="btn btn-secondary">Nous écrire</Link>
        </div>
      </div>
    );
  }

  if (step === STEPS.UNSUBSCRIBED) {
    return (
      <div className="auth-success-state">
        <div className="auth-success-icon">
          <CheckCircle size={64} />
        </div>
        <h1 className="auth-title">C&apos;est fait</h1>
        <p className="auth-description">
          <span className="unsub-email">{email}</span> ne recevra plus la lettre d&apos;information
          d&apos;Aux P&apos;tits Pois.
        </p>

        <p className="unsub-note">
          Si vous avez un contrat en cours, les annonces qui le concernent — fermeture de
          l&apos;AMAP, distribution annulée — continueront de vous parvenir : elles sont
          nécessaires au retrait de votre panier.
        </p>

        {error && <p className="unsub-error">{error}</p>}

        <div className="unsub-actions">
          <button
            type="button"
            className="unsub-undo"
            onClick={() => submit(newsletterPreferences.resubscribe, STEPS.SUBSCRIBED)}
            disabled={working}
          >
            {working ? 'Un instant…' : 'C\'était une erreur, me réinscrire'}
          </button>
          <Link href="/" className="btn btn-secondary">Retour à l&apos;accueil</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-success-state">
      <div className="unsub-icon">
        <MailX size={64} />
      </div>
      <h1 className="auth-title">Ne plus recevoir la lettre d&apos;information</h1>
      <p className="auth-description">
        Vous êtes sur le point de retirer <span className="unsub-email">{email}</span> de la liste
        de diffusion d&apos;Aux P&apos;tits Pois.
      </p>

      <p className="unsub-note">
        Si vous avez un contrat en cours, les annonces qui le concernent — fermeture de
        l&apos;AMAP, distribution annulée — continueront de vous parvenir : elles sont
        nécessaires au retrait de votre panier.
      </p>

      {error && <p className="unsub-error">{error}</p>}

      <div className="unsub-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => submit(newsletterPreferences.unsubscribe, STEPS.UNSUBSCRIBED)}
          disabled={working}
        >
          {working ? 'Un instant…' : 'Confirmer mon désabonnement'}
        </button>
        <Link href="/" className="btn btn-secondary">Annuler</Link>
      </div>
    </div>
  );
}

export default function DesabonnementPage() {
  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-container">
          {/* useSearchParams lit une valeur que le serveur ignore au moment du
              rendu : Next.js exige qu'on lui dise quoi afficher en attendant. */}
          <Suspense fallback={(
            <div className="auth-success-state">
              <div className="auth-loading-icon">
                <Loader size={64} />
              </div>
              <p>Chargement…</p>
            </div>
          )}
          >
            <UnsubscribeContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
