'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import '../../styles/public/cookies.css';

/* Identifiant de la finalité déclarée à Orejime (components/CookieConsent.js).
   Le cookie de consentement porte le nom par défaut de la bibliothèque. */
const PURPOSE_ID = 'google-analytics';
const CONSENT_COOKIE = 'eu-consent';
const CONSENT_DAYS = 120;

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
/* GA4 dépose _ga et un cookie par conteneur, nommé d'après l'identifiant de mesure */
const GA_CONTAINER_COOKIE = GA_ID ? `_ga_${GA_ID.replace(/^G-/, '')}` : null;

const MESSAGES = {
  on: 'Préférences enregistrées — la mesure anonymisée est active. Merci, ça nous aide à écrire les bonnes pages.',
  off: 'Préférences enregistrées — aucune mesure d\'audience ne sera déposée sur cet appareil.',
  all: 'Tout accepté — nécessaires et analytiques. Merci.',
  none: 'Optionnel refusé — seuls les cookies nécessaires au fonctionnement du site restent actifs.',
};

/* Le cookie de consentement n'est pas httpOnly : son contenu se lit directement,
   sans attendre le chargement d'Orejime, ce qui évite d'afficher un état faux
   pendant la seconde qui suit l'arrivée sur la page. */
function readStoredConsent() {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  if (!entry) return null;
  try {
    return JSON.parse(decodeURIComponent(entry.slice(CONSENT_COOKIE.length + 1)));
  } catch {
    return null;
  }
}

export default function CookiesPage() {
  /* `analytics` est la position de l'interrupteur, `saved` le choix réellement
     déposé sur l'appareil : ils divergent tant que l'on n'a pas enregistré. */
  const [analytics, setAnalytics] = useState(false);
  const [saved, setSaved] = useState(null);
  const [read, setRead] = useState(false);
  const [manager, setManager] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [flash, setFlash] = useState('');

  /* Premier passage : l'état affiché vient du cookie, pas de la bibliothèque */
  useEffect(() => {
    const stored = readStoredConsent();
    if (stored && typeof stored[PURPOSE_ID] === 'boolean') {
      setAnalytics(stored[PURPOSE_ID]);
      setSaved(stored[PURPOSE_ID]);
    }
    setRead(true);
  }, []);

  /* Orejime est chargé après l'hydratation : on l'attend pour pouvoir écrire */
  useEffect(() => {
    if (!GA_ID) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      if (window.orejime?.manager) {
        setManager(window.orejime.manager);
        clearInterval(timer);
      } else if ((tries += 1) > 50) {
        setUnavailable(true);
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const commit = useCallback((value, message) => {
    if (!manager) return;
    /* setConsents écrit le cookie, injecte ou retire les scripts de mesure
       et efface les cookies de la finalité refusée. */
    manager.setConsents({ [PURPOSE_ID]: value });
    setAnalytics(value);
    setSaved(value);
    setFlash(message);
  }, [manager]);

  const toggleAnalytics = () => {
    setAnalytics((current) => !current);
    setFlash('');
  };

  const statusLabel = !read ? '—' : saved === null ? 'non enregistré' : saved ? 'acceptés' : 'refusés';
  const statusClass = saved === null ? 'cookie-status-pending' : saved ? 'cookie-status-on' : 'cookie-status-off';

  return (
    <div className="cookies-page">

      {/* Hero */}
      <section className="cookie-hero">
        <div className="cookie-crumb">
          <Link href="/mentions-legales" className="cookie-crumb-link">
            Mentions légales
          </Link>
          <span className="cookie-crumb-sep">/</span>
          <span className="cookie-crumb-current">Gestion des cookies</span>
        </div>
        <h1 className="cookie-title">Vous décidez ce qu&apos;on mesure.</h1>
        <p className="cookie-lede">
          Deux familles de cookies, pas plus. Les premiers font marcher le site, les
          seconds nous disent quelles pages sont lues. Aucun cookie publicitaire, aucun
          traceur revendu.
        </p>
      </section>

      <section className="cookie-body">

        <div className="cookie-main">

          {flash && (
            <div className="success-band cookie-flash" role="status">
              <span className="success-band-dot" />
              <span className="success-band-text">{flash}</span>
            </div>
          )}

          {unavailable && (
            <div className="notice-band cookie-flash" role="status">
              <span className="notice-band-dot" />
              <span className="notice-band-text">
                Le gestionnaire de consentement n&apos;a pas pu se charger — une extension
                de navigateur le bloque peut-être. Vos préférences ne peuvent pas être
                enregistrées depuis cette page pour le moment.
              </span>
            </div>
          )}

          {/* Cookies nécessaires */}
          <article className="cookie-card cookie-card-first">
            <div className="cookie-card-head">
              <div>
                <h2 className="cookie-card-title">Cookies strictement nécessaires</h2>
                <p className="cookie-card-sub">
                  Sans eux, la connexion et la demande d&apos;abonnement ne fonctionnent
                  pas.
                </p>
              </div>
              <div className="cookie-card-state">
                <span className="cookie-badge cookie-badge-fixed">Toujours actifs</span>
                <span className="cookie-switch cookie-switch-locked" aria-hidden="true">
                  <span className="cookie-switch-knob" />
                </span>
              </div>
            </div>
            <div className="cookie-card-body">
              <dl className="def-list def-list-flush cookie-rows">
                <div className="def-row">
                  <dt className="cookie-name">authToken</dt>
                  <dd className="def-value">
                    Vous identifier et garder votre session ouverte
                  </dd>
                  <dd className="cookie-span">7 jours</dd>
                </div>
                <div className="def-row">
                  <dt className="cookie-name">{CONSENT_COOKIE}</dt>
                  <dd className="def-value">
                    Mémorise les choix que vous faites sur cette page
                  </dd>
                  <dd className="cookie-span">{CONSENT_DAYS} jours</dd>
                </div>
                <div className="def-row">
                  <dt className="cookie-name">auth_known</dt>
                  <dd className="def-value">
                    Se souvenir qu&apos;une session a déjà été ouverte sur cet appareil
                  </dd>
                  <dd className="cookie-span">déconnexion</dd>
                </div>
                <div className="def-row">
                  {/* Trop longue pour la colonne : la coupe est posée sur les
                      charnières du camelCase plutôt qu'au milieu d'un mot. */}
                  <dt className="cookie-name">
                    pending<wbr />Subscription<wbr />Request
                  </dt>
                  <dd className="def-value">
                    Retenir une demande d&apos;abonnement le temps de vous connecter
                  </dd>
                  <dd className="cookie-span">onglet fermé</dd>
                </div>
                <div className="def-row def-row-wide">
                  <dt className="def-label">Stockage local</dt>
                  <dd className="def-value cookie-value-loose">
                    Les deux dernières lignes ne sont pas des cookies mais du stockage
                    tenu par le navigateur. Elles obéissent aux mêmes règles et
                    disparaissent à la déconnexion ou à la fermeture de l&apos;onglet.
                  </dd>
                </div>
              </dl>
            </div>
          </article>

          {/* Cookies analytiques */}
          {GA_ID ? (
            <article className="cookie-card">
              <div className="cookie-card-head">
                <div>
                  <h2 className="cookie-card-title">Cookies analytiques</h2>
                  <p className="cookie-card-sub">
                    Google Analytics, en mesure anonymisée. Optionnels.
                  </p>
                </div>
                <div className="cookie-card-state">
                  <span
                    className={`cookie-badge ${analytics ? 'cookie-badge-on' : 'cookie-badge-off'}`}
                  >
                    {analytics ? 'Activés' : 'Désactivés'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={analytics}
                    aria-label={
                      analytics
                        ? 'Désactiver les cookies analytiques'
                        : 'Activer les cookies analytiques'
                    }
                    onClick={toggleAnalytics}
                    className={`cookie-switch ${analytics ? 'cookie-switch-on' : ''}`}
                  >
                    <span className="cookie-switch-knob" />
                  </button>
                </div>
              </div>
              <div className="cookie-card-body">
                <dl className="def-list def-list-flush cookie-rows">
                  <div className="def-row">
                    <dt className="cookie-name">_ga</dt>
                    <dd className="def-value">Distingue les visiteurs de façon anonyme</dd>
                    <dd className="cookie-span">13 mois</dd>
                  </div>
                  <div className="def-row">
                    <dt className="cookie-name">{GA_CONTAINER_COOKIE}</dt>
                    <dd className="def-value">Mesure les pages vues et la durée de visite</dd>
                    <dd className="cookie-span">13 mois</dd>
                  </div>
                  <div className="def-row def-row-wide">
                    <dt className="def-label">À quoi ça sert</dt>
                    <dd className="def-value cookie-value-loose">
                      Savoir quelles pages sont réellement lues — par exemple si la FAQ
                      répond aux questions, ou si la page producteurs est consultée. Rien
                      n&apos;est croisé avec votre compte adhérent.
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          ) : (
            <p className="form-note cookie-none">
              Aucun outil de mesure d&apos;audience n&apos;est installé sur ce site : seuls
              les cookies nécessaires ci-dessus sont déposés, et il n&apos;y a rien à
              régler.
            </p>
          )}

          {GA_ID && (
            <>
              <div className="cookie-actions">
                <button
                  type="button"
                  className="btn-cta btn-cta-primary"
                  onClick={() => commit(analytics, analytics ? MESSAGES.on : MESSAGES.off)}
                  disabled={!manager}
                >
                  Enregistrer mes choix
                </button>
                <button
                  type="button"
                  className="btn-cta btn-cta-ghost"
                  onClick={() => commit(true, MESSAGES.all)}
                  disabled={!manager}
                >
                  Tout accepter
                </button>
                <button
                  type="button"
                  className="btn-cta btn-cta-ghost"
                  onClick={() => commit(false, MESSAGES.none)}
                  disabled={!manager}
                >
                  Refuser l&apos;optionnel
                </button>
              </div>
              <p className="form-note cookie-note">
                Refuser les cookies analytiques ne dégrade rien : vous gardez l&apos;accès
                au panier de la semaine, aux recettes et à votre espace adhérent.
              </p>
            </>
          )}
        </div>

        <aside className="cookie-aside">

          <div className="side-card">
            <div className="side-card-head">
              <h2 className="side-card-title">Votre choix actuel</h2>
            </div>
            <div className="side-card-body">
              <div className="split-list cookie-status">
                <div className="split-row">
                  <span className="split-label">Nécessaires</span>
                  <span className="split-value cookie-status-on">actifs</span>
                </div>
                <div className="split-row">
                  <span className="split-label">Analytiques</span>
                  <span className={`split-value ${GA_ID ? statusClass : ''}`}>
                    {GA_ID ? statusLabel : 'aucun'}
                  </span>
                </div>
                <div className="split-row">
                  <span className="split-label">Publicitaires</span>
                  <span className="split-value">aucun</span>
                </div>
              </div>
              <p className="cookie-status-note">
                {!read
                  ? 'Lecture de vos préférences sur cet appareil…'
                  : saved === null
                    ? 'Vos préférences ne sont pas encore enregistrées sur cet appareil.'
                    : `Choix enregistré pour ${CONSENT_DAYS} jours. Vous pouvez revenir ici à tout moment.`}
              </p>
            </div>
          </div>

          <div className="forest-card">
            <div className="eyebrow">Vos droits</div>
            <p className="forest-card-text">
              Accès, rectification, suppression : l&apos;export et la suppression de compte
              se font depuis votre espace adhérent, sans passer par nous.
            </p>
            <Link href="/compte" className="forest-card-link">
              Mon espace adhérent
            </Link>
          </div>

          <div className="cookie-links">
            <div className="eyebrow cookie-links-label">Aller plus loin</div>
            <div className="cookie-links-list">
              <Link href="/mentions-legales#cookies" className="cookie-link">
                Politique de cookies détaillée
              </Link>
              <Link href="/mentions-legales#tiers" className="cookie-link">
                Services tiers utilisés
              </Link>
              <Link href="/contact" className="cookie-link">
                Poser une question
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
