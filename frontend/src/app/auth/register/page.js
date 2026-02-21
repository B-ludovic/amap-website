'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth as authApi } from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import RegisterForm from '../../../components/auth/RegisterForm';

function RegisterPage() {
  const router = useRouter();
  const { showError, showSuccess } = useModal();
  const [loading, setLoading] = useState(false);

  const handleRegister = async (userData) => {
    setLoading(true);

    try {
      await authApi.register(userData);

      showSuccess(
        'Inscription réussie !',
        'Un email de confirmation a été envoyé. Cliquez sur le lien pour activer votre compte.'
      );

      router.push('/auth/login');
    } catch (err) {
      showError('Erreur d\'inscription', err.message);
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