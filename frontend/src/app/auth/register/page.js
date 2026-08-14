'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api, { auth as authApi } from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import RegisterForm from '../../../components/auth/RegisterForm';
import '../../../styles/public/register.css';

/* Nombre de distributions par an : constante de l'association, affichée telle
   quelle sur la landing et les abonnements. Les deux autres chiffres viennent
   de la base ; tant qu'ils ne sont pas là, la carte montre un tiret plutôt
   qu'une valeur inventée. */
const DISTRIBUTIONS_PER_YEAR = 49;

/* Ce qui attend l'adhérent une fois le compte activé. */
const NEXT_STEPS = [
  'Activez votre compte depuis l’email reçu',
  'Déposez une demande d’abonnement — petit ou grand panier',
  'Un bénévole vous rappelle pour le contrat et le règlement',
];

function RegisterPage() {
  const { showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [figures, setFigures] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.stats.getPublic()
      .then((response) => {
        if (!cancelled) setFigures(response.data);
      })
      .catch(() => {
        // Chiffres indisponibles : la carte reste au tiret, sans rien inventer.
      });

    return () => { cancelled = true; };
  }, []);

  const handleRegister = async (userData) => {
    setLoading(true);

    try {
      await authApi.register(userData);
      setSentTo(userData.email);
    } catch (err) {
      showError('Erreur d\'inscription', err.message);
    } finally {
      setLoading(false);
    }
  };

  const isDone = Boolean(sentTo);

  const figureRows = [
    { label: 'Foyers adhérents', value: figures ? String(figures.households) : '—' },
    { label: 'Fermes partenaires', value: figures ? String(figures.producers) : '—' },
    { label: 'Distributions par an', value: String(DISTRIBUTIONS_PER_YEAR) },
  ];

  return (
    <div className="register-page">

      {isDone ? (
        <div className="register-done">
          <div className="pill-success">
            <span className="pill-success-dot" aria-hidden="true" />
            <span className="pill-success-label">Compte créé</span>
          </div>

          <h1 className="register-done-title">Vérifiez votre boîte mail.</h1>

          <p className="register-done-lede">
            Un email de confirmation est parti à{' '}
            <span className="register-done-mail">{sentTo}</span>. Cliquez sur le lien
            qu&apos;il contient pour activer votre compte — sans ça, vous ne recevrez pas la
            composition du panier.
          </p>

          <ol className="numbered-steps numbered-steps-ruled">
            {NEXT_STEPS.map((step, index) => (
              <li className="numbered-step" key={step}>
                <span className="numbered-step-number">0{index + 1}</span>
                <span className="numbered-step-text">{step}</span>
              </li>
            ))}
          </ol>

          <div className="register-done-actions">
            <Link href="/nos-abonnements" className="btn-cta btn-cta-primary">
              Choisir mon abonnement
            </Link>
            <button
              type="button"
              className="btn-cta btn-cta-ghost"
              onClick={() => setSentTo('')}
            >
              Créer un autre compte
            </button>
          </div>
        </div>
      ) : (
        <div className="register-main">
          <div className="eyebrow">Créer un compte</div>

          <h1 className="register-title">Inscription.</h1>

          <p className="register-lede">
            Le compte vous donne accès au panier de la semaine et vous permet de déposer une
            demande d&apos;abonnement.
          </p>

          <div className="notice-band register-notice">
            <span className="notice-band-dot" aria-hidden="true" />
            <span className="notice-band-text">
              Créer un compte ne vous engage à rien : l&apos;adhésion se fait ensuite, par une
              demande d&apos;abonnement.
            </span>
          </div>

          <RegisterForm onSubmit={handleRegister} loading={loading} />
        </div>
      )}

      <aside className="register-aside">
        <div className="register-figures">
          <Image
            src="/images/panier-hero.webp"
            alt="Panier de légumes de saison"
            width={360}
            height={450}
            sizes="360px"
            className="register-figures-photo"
          />
          <div className="register-figures-body">
            <div className="side-block-label">Ce que vous rejoignez</div>
            <dl className="register-figures-list">
              {figureRows.map((row) => (
                <div className="register-figure" key={row.label}>
                  <dt className="register-figure-label">{row.label}</dt>
                  <dd className="register-figure-value">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="forest-card">
          <div className="eyebrow">Bon à savoir</div>
          <p className="forest-card-text">
            Le tarif solidaire, en partenariat avec le Secours Catholique, ramène votre part à
            20 % du prix. Dites-le-nous simplement, sans dossier lourd.
          </p>
          <Link href="/nos-abonnements" className="forest-card-link">
            Voir les tarifs
          </Link>
        </div>
      </aside>
    </div>
  );
}

export default RegisterPage;
