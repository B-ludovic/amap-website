'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../../contexts/AuthContext';
import { auth as authApi } from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import LoginForm from '../../../components/auth/LoginForm';
import '../../../styles/public/login.css';

function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, login, logout } = useAuth();
  const { showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');

  const handleLogin = async (credentials) => {
    setLoading(true);
    setUnconfirmedEmail('');

    try {
      const data = await authApi.login(credentials);

      // Mettre à jour le contexte (le cookie est posé automatiquement par le backend)
      login(data.data.user);

      // Redirection vers la page d'accueil
      router.push('/');
    } catch (err) {
      /* Une adresse non confirmée n'est pas une faute de saisie : réessayer n'y
         changera rien. On garde donc la page ouverte sur le recours plutôt que
         de fermer une fenêtre d'erreur qui laisserait l'adhérent au même point. */
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setUnconfirmedEmail(credentials.email);
      } else {
        showError('Erreur de connexion', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const isSignedIn = !authLoading && Boolean(user);

  return (
    <div className="login-page">
      <div className="login-form-side">
        <div className="login-form-inner">

          {isSignedIn ? (
            <div>
              <div className="pill-success login-session-badge">
                <span className="pill-success-dot" aria-hidden="true" />
                <span className="pill-success-label">Session ouverte</span>
              </div>
              <h1 className="login-title login-title-back">Content de vous revoir.</h1>
              <p className="login-lede">
                Redirection vers votre espace adhérent. Le panier de la semaine y est
                déjà publié.
              </p>
              <div className="login-session-actions">
                <Link href="/compte" className="form-submit login-submit-link">
                  Aller à mon espace
                </Link>
                <button type="button" className="login-secondary" onClick={logout}>
                  Changer de compte
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="login-eyebrow">Espace adhérent</div>
              <h1 className="login-title">Connexion.</h1>
              <p className="login-lede">
                Retrouvez le panier de la semaine, votre contrat, vos permanences et vos
                semaines de pause.
              </p>

              <LoginForm onSubmit={handleLogin} loading={loading} />

              {unconfirmedEmail && (
                <div className="notice-band login-unconfirmed">
                  <span className="notice-band-dot" aria-hidden="true" />
                  <span className="notice-band-text">
                    Cette adresse n&apos;est pas encore confirmée. Ouvrez le lien reçu à
                    l&apos;inscription, ou{' '}
                    <Link
                      href={`/auth/renvoyer-confirmation?email=${encodeURIComponent(unconfirmedEmail)}`}
                      className="login-link-strong"
                    >
                      faites-vous en renvoyer un
                    </Link>
                    .
                  </span>
                </div>
              )}

              <div className="login-links">
                <span className="login-links-text">
                  Pas encore de compte ?{' '}
                  <Link href="/auth/register" className="login-link-strong">
                    Inscrivez-vous
                  </Link>
                </span>
                <Link href="/auth/forgot-password" className="login-link-muted">
                  Mot de passe oublié ?
                </Link>
              </div>

              <p className="login-note">
                Adhérer se fait en amont, par la demande d&apos;abonnement. Votre compte
                est créé à la validation du contrat.
              </p>
            </div>
          )}

        </div>
      </div>

      <aside className="login-visual">
        <Image
          src="/images/ferme-petits-fruits.webp"
          alt="Jardin maraîcher partenaire"
          fill
          sizes="(max-width: 900px) 100vw, 50vw"
          className="login-visual-photo"
          priority
        />
        <div className="login-visual-veil" aria-hidden="true" />
        <div className="login-visual-content">
          <div className="login-visual-label">Prochaine distribution</div>
          <div className="login-visual-title">Mercredi, 18h15 — 19h15</div>
          <dl className="login-visual-rows">
            <div className="login-visual-row">
              <dt className="login-visual-label">Lieu</dt>
              <dd className="login-visual-value">
                Paroisse Saint François de Sales, Clamart
              </dd>
            </div>
            <div className="login-visual-row">
              <dt className="login-visual-label">Panier</dt>
              <dd className="login-visual-value">
                Semaine 33 · tomates, courgettes, basilic et 4 autres
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}

export default LoginPage;
