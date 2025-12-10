'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { auth as authApi } from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';

function ForgotPasswordPage() {
  const { showSuccess, showError } = useModal();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setEmailSent(true);
      showSuccess(
        'Email envoyé',
        'Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation.'
      );
    } catch (err) {
      showError('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="auth-page">
        <div className="container">
          <div className="auth-container">
            <div className="auth-success-state">
              <div className="auth-success-icon">
                <Mail size={48} />
              </div>
              <h1 className="auth-title">Email envoyé !</h1>
              <p className="auth-description">
                Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez 
                un email contenant un lien de réinitialisation de votre mot de passe.
              </p>
              <p className="auth-description">
                Le lien sera valide pendant 1 heure.
              </p>
              <div className="auth-success-actions">
                <Link href="/auth/login" className="btn btn-primary">
                  Retour à la connexion
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">Mot de passe oublié ?</h1>
            <p className="auth-description">
              Entrez votre adresse email et nous vous enverrons un lien pour 
              réinitialiser votre mot de passe.
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
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
            </button>
          </form>

          <div className="auth-footer">
            <Link href="/auth/login" className="auth-footer-link">
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
