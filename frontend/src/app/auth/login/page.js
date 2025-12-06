'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import { auth as authApi } from '../../../lib/api';
import LoginForm from '../../../components/auth/LoginForm';

function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (credentials) => {
    setLoading(true);
    setError('');

    try {
      const data = await authApi.login(credentials);

      // Sauvegarder le token et mettre à jour le contexte
      login(data.data.token, data.data.user);

      // Redirection vers la page d'accueil
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">Connexion</h1>
            <p className="auth-description">
              Connectez-vous pour accéder à votre compte et commander vos paniers.
            </p>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <LoginForm onSubmit={handleLogin} loading={loading} />

          <div className="auth-footer">
            <p className="auth-footer-text">
              Pas encore de compte ?{' '}
              <Link href="/auth/register" className="auth-footer-link">
                Inscrivez-vous
              </Link>
            </p>
            <Link href="/auth/forgot-password" className="auth-footer-link">
              Mot de passe oublié ?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


export default LoginPage;