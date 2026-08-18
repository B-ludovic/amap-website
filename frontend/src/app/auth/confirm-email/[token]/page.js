'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader, MailCheck } from 'lucide-react';
import { auth as authApi } from '../../../../lib/api';

export default function ConfirmEmailPage() {
  const { token } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  /* La confirmation part d'un clic, jamais du chargement de la page.
     Certaines passerelles de messagerie d'entreprise ouvrent les liens reçus
     dans un navigateur sans tête et exécutent leur JavaScript : une
     confirmation déclenchée à l'affichage serait consommée par cette
     inspection, et l'adhérent, en arrivant, lirait « lien invalide » sur un
     compte pourtant validé. Un bouton ne se clique pas tout seul. */
  const confirmer = async () => {
    if (!token || status === 'loading') return;

    setStatus('loading');

    try {
      await authApi.confirmEmail(token);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Lien de confirmation invalide ou expiré.');
    }
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-container">
          {status === 'idle' && (
            <div className="auth-success-state">
              <div className="auth-loading-icon">
                <MailCheck size={64} />
              </div>
              <h1 className="auth-title">Confirmez votre adresse</h1>
              <p className="auth-description">
                Dernière étape avant de pouvoir vous connecter.
              </p>
              <div className="auth-success-actions">
                <button className="btn btn-primary" onClick={confirmer}>
                  Confirmer mon adresse
                </button>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="auth-success-state">
              <div className="auth-loading-icon">
                <Loader size={64} />
              </div>
              <p>Confirmation en cours...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="auth-success-state">
              <div className="auth-success-icon">
                <CheckCircle size={64} />
              </div>
              <h1 className="auth-title">Email confirmé !</h1>
              <p className="auth-description">
                Votre adresse email a été confirmée avec succès.
                Vous pouvez maintenant vous connecter.
              </p>
              <div className="auth-success-actions">
                <button className="btn btn-primary" onClick={() => router.push('/auth/login')}>
                  Se connecter
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="auth-success-state">
              <div className="auth-error-icon">
                <XCircle size={64} />
              </div>
              <h1 className="auth-title">Confirmation échouée</h1>
              <p className="auth-description">{message}</p>
              <div className="auth-success-actions">
                <Link href="/auth/renvoyer-confirmation" className="btn btn-primary">
                  Recevoir un nouveau lien
                </Link>
                <button className="btn btn-secondary" onClick={() => router.push('/auth/login')}>
                  Retour à la connexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
