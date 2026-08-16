'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useFocusTrap } from '../hooks/useFocusTrap';
import '../styles/components/modal.css';
import '../styles/components/invite-gate.css';

export default function InviteGate() {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.message ?? 'Accès refusé.');
        setPassword('');
        setLoading(false);
        return;
      }

      /* Rechargement complet plutôt que router.refresh() : le laissez-passer
         vient d'être posé en cookie, et seule une nouvelle requête de document
         repasse par le middleware, qui lèvera la réécriture vers cette page.
         L'URL demandée au départ n'a pas bougé, elle s'affiche telle quelle. */
      window.location.reload();
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau et réessayez.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay invite-gate-overlay">
      <div
        ref={containerRef}
        className="modal-container invite-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-gate-title"
        aria-describedby="invite-gate-intro"
      >
        <div className="invite-gate-head">
          <Image
            src="/icons/logo.png"
            alt=""
            width={48}
            height={48}
            aria-hidden="true"
            priority
          />
          <h1 id="invite-gate-title" className="modal-title">Accès sur invitation</h1>
          <p id="invite-gate-intro" className="modal-message">
            Le site n&apos;est pas encore ouvert au public. Saisissez l&apos;adresse et le mot
            de passe qui vous ont été communiqués pour y accéder.
          </p>
        </div>

        {/* method="post" alors que l'envoi passe par fetch : sans JavaScript, un
            formulaire sans méthode se soumet en GET et écrit le mot de passe dans
            l'URL, donc dans l'historique et les journaux de l'hébergeur. */}
        <form className="invite-gate-form" method="post" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="form-alert" role="alert">
              <span className="form-alert-dot" />
              <span className="form-alert-text">{error}</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="invite-email" className="field-label">Adresse email</label>
            <input
              type="text"
              inputMode="email"
              id="invite-email"
              name="email"
              className={`input ${error ? 'input-error' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              autoComplete="email"
              disabled={loading}
              required
            />
          </div>

          <div className="field">
            <div className="field-head">
              <label htmlFor="invite-password" className="field-label">Mot de passe</label>
              <button
                type="button"
                className="reveal-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              id="invite-password"
              name="password"
              className={`input ${error ? 'input-error' : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary invite-gate-submit" disabled={loading}>
            {loading ? 'Vérification…' : 'Entrer'}
          </button>
        </form>
      </div>
    </div>
  );
}
