'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoginForm from '../../../components/auth/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (credentials) => {
    setLoading(true);
    setError('');

    try {
      // TODO: Appeler l'API réelle
      const response = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Erreur lors de la connexion');
      }

      // Sauvegarder le token
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));

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