'use client';

import { useEffect } from 'react';
import { tarteaucitronConfig, tarteaucitronServices } from '../config/tarteaucitron.config';

export default function CookieConsent() {
  useEffect(() => {
    // Vérifier si on est côté client
    if (typeof window === 'undefined') return;

    // Charger le script principal
    const script = document.createElement('script');
    script.src = '/tarteaucitron/tarteaucitron.js';
    script.async = true;

    script.onload = () => {
      // Vérifier que tarteaucitron est chargé
      if (!window.tarteaucitron) {
        console.error('Tarteaucitron failed to load');
        return;
      }

      // Charger les définitions de services avant d'initialiser
      const servicesScript = document.createElement('script');
      servicesScript.src = '/tarteaucitron/tarteaucitron.services.js';

      servicesScript.onload = () => {
        // Éviter la double initialisation (React StrictMode, re-render)
        if (window.tarteaucitron.state) return;

        const { googleAnalytics, youtube, googleMaps } = tarteaucitronServices;

        // Réinitialiser job pour éviter les résidus d'une exécution précédente
        window.tarteaucitron.job = [];

        // Pré-remplir les données utilisateur avant init
        if (googleAnalytics.enabled) {
          window.tarteaucitron.user.gtagUa = googleAnalytics.id;
          window.tarteaucitron.user.gtagMore = function () {};
        }
        if (googleMaps.enabled && googleMaps.apiKey) {
          window.tarteaucitron.user.googlemapsKey = googleMaps.apiKey;
        }

        // Initialiser Tarteaucitron
        window.tarteaucitron.init(tarteaucitronConfig);

        // Push uniquement les services définis dans tarteaucitron.services
        const pushService = (key) => {
          if (window.tarteaucitron.services?.[key]) {
            window.tarteaucitron.job.push(key);
          }
        };

        if (googleAnalytics.enabled) pushService('gtag');
        if (youtube.enabled)         pushService('youtube');
        if (googleMaps.enabled && googleMaps.apiKey) pushService('googlemaps');
      };

      document.head.appendChild(servicesScript);
    };

    script.onerror = () => {
      console.error('❌ Erreur de chargement de Tarteaucitron');
    };

    document.head.appendChild(script);

    // Cleanup
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return null;
}
