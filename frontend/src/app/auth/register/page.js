'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import { auth as authApi } from '../../../lib/api';
import RegisterForm from '../../../components/auth/RegisterForm';

function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (userData) => {
    setLoading(true);
    setError('');

    try {
      const data = await authApi.register(userData);

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
            <h1 className="auth-title">Inscription</h1>
            <p className="auth-description">
              Créez votre compte pour commencer à commander vos paniers.
            </p>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <RegisterForm onSubmit={handleRegister} loading={loading} />

          <div className="auth-footer">
            <p className="auth-footer-text">
              Vous avez déjà un compte ?{' '}
              <Link href="/auth/login" className="auth-footer-link">
                Connectez-vous
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;