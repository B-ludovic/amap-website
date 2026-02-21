'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { auth as authApi } from '../../../../lib/api';
import '../../../../styles/public/auth.css';

export default function ConfirmEmailPage() {
  const { token } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    authApi.confirmEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Lien de confirmation invalide ou expiré.');
      });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-container">
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
