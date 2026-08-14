'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/* 13 mois, durée maximale recommandée par la CNIL pour un traceur de mesure
   d'audience. Sans ce réglage, GA4 pose _ga pour deux ans. */
const GA_COOKIE_SECONDS = 395 * 24 * 60 * 60;

export default function CookieConsent({ nonce }) {
  /* GA4 dépose _ga et un cookie par conteneur, nommé d'après l'identifiant de
     mesure : les deux doivent être listés pour qu'un refus les efface. */
  const gaCookies = GA_ID ? ['_ga', `_ga_${GA_ID.replace(/^G-/, '')}`] : [];

  const config = {
    privacyPolicyUrl: '/mentions-legales#cookies',
    purposes: [
      ...(GA_ID ? [{
        id: 'google-analytics',
        title: 'Google Analytics',
        description: 'Mesure d\'audience anonymisée pour comprendre comment le site est utilisé.',
        isMandatory: false,
        cookies: gaCookies,
      }] : []),
    ],
  };

  return (
    <>
      <Script
        id="orejime-config"
        strategy="afterInteractive"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: `window.orejimeConfig = ${JSON.stringify(config).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')};` }}
      />
      <Script src="/orejime/orejime-standard-fr.js" strategy="afterInteractive" nonce={nonce} />
      {GA_ID && (
        <Script
          id="ga-template"
          strategy="afterInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              var t = document.createElement('template');
              t.setAttribute('data-purpose', 'google-analytics');
              t.innerHTML = '<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"><\\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","${GA_ID}",{cookie_expires:${GA_COOKIE_SECONDS}});<\\/script>';
              document.head.appendChild(t);
            `,
          }}
        />
      )}
    </>
  );
}
