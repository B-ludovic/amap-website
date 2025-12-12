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

      // Initialiser Tarteaucitron
      window.tarteaucitron.init(tarteaucitronConfig);

      // Activer les services
      const { googleAnalytics, stripe, youtube, googleMaps } = tarteaucitronServices;

      // Google Analytics
      if (googleAnalytics.enabled) {
        window.tarteaucitron.user.gtagUa = googleAnalytics.id;
        window.tarteaucitron.user.gtagMore = function () {
          // Configuration supplémentaire GA si nécessaire
        };
        (window.tarteaucitron.job = window.tarteaucitron.job || []).push('gtag');
      }

      // Stripe (obligatoire)
      if (stripe.enabled) {
        (window.tarteaucitron.job = window.tarteaucitron.job || []).push('stripe');
      }

      // YouTube
      if (youtube.enabled) {
        (window.tarteaucitron.job = window.tarteaucitron.job || []).push('youtube');
      }

      // Google Maps
      if (googleMaps.enabled && googleMaps.apiKey) {
        window.tarteaucitron.user.googlemapsKey = googleMaps.apiKey;
        (window.tarteaucitron.job = window.tarteaucitron.job || []).push('googlemaps');
      }

      console.log('✅ Tarteaucitron initialisé');
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