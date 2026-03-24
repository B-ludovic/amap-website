'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function CookieConsent() {
  const config = {
    privacyPolicyUrl: '/mentions-legales#cookies',
    purposes: [
      ...(GA_ID ? [{
        id: 'google-analytics',
        title: 'Google Analytics',
        description: 'Mesure d\'audience anonymisée pour comprendre comment le site est utilisé.',
        isMandatory: false,
        cookies: ['_ga', '_gid', '_gat'],
      }] : []),
    ],
  };

  return (
    <>
      <Script
        id="orejime-config"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: `window.orejimeConfig = ${JSON.stringify(config)};` }}
      />
      <Script src="/orejime/orejime-standard-fr.js" strategy="afterInteractive" />
      {GA_ID && (
        <Script
          id="ga-template"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              var t = document.createElement('template');
              t.setAttribute('data-purpose', 'google-analytics');
              t.innerHTML = '<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"><\\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","${GA_ID}");<\\/script>';
              document.head.appendChild(t);
            `,
          }}
        />
      )}
    </>
  );
}
