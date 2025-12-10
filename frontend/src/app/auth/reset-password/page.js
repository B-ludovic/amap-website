'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { auth as authApi } from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';

function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useModal();
  
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      showError('Token manquant', 'Le lien de réinitialisation est invalide.');
      router.push('/auth/forgot-password');
    }
  }, [searchParams, router, showError]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showError('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 6) {
      showError('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      showSuccess(
        'Mot de passe réinitialisé',
        'Votre mot de passe a été changé avec succès. Vous pouvez maintenant vous connecter.'
      );
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err) {
      showError('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="container">
          <div className="auth-container">
            <div className="auth-success-state">
              <div className="auth-success-icon">
                <CheckCircle size={48} />
              </div>
              <h1 className="auth-title">Mot de passe réinitialisé !</h1>
              <p className="auth-description">
                Votre mot de passe a été changé avec succès.
              </p>
              <p className="auth-description">
                Redirection vers la page de connexion...
              </p>
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
            <h1 className="auth-title">Réinitialiser le mot de passe</h1>
            <p className="auth-description">
              Choisissez un nouveau mot de passe pour votre compte.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Nouveau mot de passe
              </label>
              <div className="form-input-group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="form-input-icon-btn"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="form-hint">Minimum 6 caractères</p>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmer le mot de passe
              </label>
              <div className="form-input-group">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="form-input-icon-btn"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
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

export default ResetPasswordPage;
