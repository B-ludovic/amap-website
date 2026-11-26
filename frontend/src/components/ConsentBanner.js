'use client';

import { useEffect } from 'react';
import * as CookieConsent from 'vanilla-cookieconsent';
import { ANALYTICS, CONSENT_COOKIE, CONSENT_DAYS, GA_ID } from '../lib/consent';

/* 13 mois, durée maximale recommandée par la CNIL pour un traceur de mesure
   d'audience. Sans ce réglage, GA4 pose _ga pour deux ans. */
const GA_COOKIE_SECONDS = 395 * 24 * 60 * 60;

let analyticsLoaded = false;

/* gtag.js reconnaît ses commandes à leur objet `arguments` : une fonction
   fléchée ou un paramètre rest les rendrait illisibles. */
function gtag() {
  window.dataLayer.push(arguments);
}

function startAnalytics() {
  window[`ga-disable-${GA_ID}`] = false;
  if (analyticsLoaded) return;
  analyticsLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { cookie_expires: GA_COOKIE_SECONDS });
  CookieConsent.loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`, { async: '' });
}

/* Un gtag.js déjà chargé reste en mémoire jusqu'au rechargement de la page :
   ce drapeau, qu'il consulte avant chaque envoi, le fait taire. */
function stopAnalytics() {
  window[`ga-disable-${GA_ID}`] = true;
}

function applyConsent() {
  if (CookieConsent.acceptedCategory(ANALYTICS)) startAnalytics();
  else stopAnalytics();
}

export default function ConsentBanner() {
  useEffect(() => {
    // Sans outil de mesure, aucun cookie optionnel : rien à demander.
    if (!GA_ID) return;

    CookieConsent.run({
      cookie: {
        name: CONSENT_COOKIE,
        expiresAfterDays: CONSENT_DAYS,
      },
      categories: {
        necessary: { enabled: true, readOnly: true },
        [ANALYTICS]: {
          autoClear: { cookies: [{ name: /^_ga/ }] },
        },
      },
      onConsent: applyConsent,
      onChange: applyConsent,
      language: {
        default: 'fr',
        translations: {
          fr: {
            consentModal: {
              title: 'Mesure d\'audience',
              description: 'Avec votre accord, Google Analytics nous indique quelles pages sont lues, en mesure anonymisée. Refuser ne change rien à l\'usage du site, et vous pouvez changer d\'avis à tout moment depuis la page <a href="/cookies">Gestion des cookies</a>.',
              acceptAllBtn: 'Accepter',
              acceptNecessaryBtn: 'Refuser',
            },
          },
        },
      },
    });
  }, []);

  return null;
}
