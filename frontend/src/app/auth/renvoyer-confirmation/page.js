'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Loader } from 'lucide-react';
import { auth as authApi } from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';

/* Le lien de confirmation vit 24 heures et le message peut ne jamais arriver —
   boîte pleine, filtre anti-spam, adresse mal saisie. Sans cette page, la
   personne est enfermée : la connexion lui est refusée tant qu'elle n'a pas
   confirmé, or le seul bouton de renvoi se trouve dans l'espace adhérent,
   derrière cette même connexion. */
function RenvoyerConfirmationContent() {
  const searchParams = useSearchParams();
  const { showError } = useModal();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authApi.resendConfirmation(email);
      setEmailSent(true);
    } catch (err) {
      showError('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  /* Le serveur répond la même chose quel que soit le compte : cet écran ne doit
     donc rien affirmer non plus, sinon il révélerait qui est inscrit ici. */
  if (emailSent) {
    return (
      <div className="auth-success-state">
        <div className="auth-success-icon">
          <Mail size={48} />
        </div>
        <h1 className="auth-title">C&apos;est envoyé.</h1>
        <p className="auth-description">
          Si un compte en attente de confirmation existe avec l&apos;adresse{' '}
          <strong>{email}</strong>, un nouveau lien vient d&apos;y être envoyé.
        </p>
        <p className="auth-description">
          Le lien est valable 24 heures. S&apos;il n&apos;arrive pas, regardez dans les
          courriers indésirables avant de redemander : un renvoi n&apos;est possible
          qu&apos;une fois toutes les cinq minutes.
        </p>
        <div className="auth-success-actions">
          <Link href="/auth/login" className="btn btn-primary">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="auth-header">
        <h1 className="auth-title">Renvoyer le lien de confirmation</h1>
        <p className="auth-description">
          Vous n&apos;avez pas reçu l&apos;email d&apos;activation, ou son lien a expiré ?
          Indiquez l&apos;adresse utilisée à l&apos;inscription, nous en envoyons un
          nouveau.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Adresse email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder="votre@email.com"
            autoComplete="email"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading}
        >
          {loading ? 'Envoi en cours...' : 'Renvoyer le lien'}
        </button>
      </form>

      <div className="auth-footer">
        <Link href="/auth/login" className="auth-footer-link">
          ← Retour à la connexion
        </Link>
      </div>
    </>
  );
}

function RenvoyerConfirmationPage() {
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
            <RenvoyerConfirmationContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default RenvoyerConfirmationPage;
