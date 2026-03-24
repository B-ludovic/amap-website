'use client';

import Script from 'next/script';
import { tarteaucitronConfig, tarteaucitronServices } from '../config/tarteaucitron.config';

export default function CookieConsent() {
  const initTarteaucitron = () => {
    if (typeof window === 'undefined' || !window.tarteaucitron) return;

    const { googleAnalytics, youtube, googleMaps } = tarteaucitronServices;

    // Charger les définitions de services (gtag, youtube, etc.) puis initialiser
    const servicesScript = document.createElement('script');
    servicesScript.src = '/tarteaucitron/tarteaucitron.services.js';
    servicesScript.onload = () => {
      window.tarteaucitron.init(tarteaucitronConfig);

      window.tarteaucitron.job = window.tarteaucitron.job || [];

      if (googleAnalytics?.enabled && googleAnalytics?.id) {
        window.tarteaucitron.user.gtagUa = googleAnalytics.id;
        window.tarteaucitron.user.gtagMore = function () {};
        window.tarteaucitron.job.push('gtag');
      }

      if (youtube?.enabled) {
        window.tarteaucitron.job.push('youtube');
      }

      if (googleMaps?.enabled && googleMaps?.apiKey) {
        window.tarteaucitron.user.googlemapsKey = googleMaps.apiKey;
        window.tarteaucitron.job.push('googlemaps');
      }
    };
    document.head.appendChild(servicesScript);
  };

  return (
    <Script
      src="/tarteaucitron/tarteaucitron.js"
      strategy="afterInteractive"
      onLoad={initTarteaucitron}
    />
  );
}
