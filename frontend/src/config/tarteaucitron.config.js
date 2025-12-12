export const tarteaucitronConfig = {
  // URL de la politique de confidentialité
  "privacyUrl": "/mentions-legales#cookies",
  
  // Position du bandeau
  "bodyPosition": "bottom", // "top" ou "bottom"
  
  // Hashtag pour ouvrir le panel
  "hashtag": "#cookies",
  
  // Nom du cookie
  "cookieName": "auxptitspois_tarteaucitron",
  
  // Position du bandeau (middle/top/bottom)
  "orientation": "middle",
  
  // Grouper les services par catégorie
  "groupServices": false,
  
  // État par défaut des services (wait/true/false)
  "serviceDefaultState": "wait",
  
  // Afficher petit bandeau après fermeture
  "showAlertSmall": false,
  
  // Afficher liste des cookies
  "cookieslist": true,
  
  // Fermer en cliquant en dehors
  "closePopup": false,
  
  // Afficher l'icône permanente
  "showIcon": true,
  
  // Position de l'icône
  "iconPosition": "BottomLeft", // BottomLeft/BottomRight/TopLeft/TopRight
  
  // Détecter les adblockers
  "adblocker": false,
  
  // Bouton "Tout refuser"
  "DenyAllCta": true,
  
  // Bouton "Tout accepter"
  "AcceptAllCta": true,
  
  // Mode haute confidentialité (services désactivés par défaut)
  "highPrivacy": true,
  
  // Respecter le Do Not Track
  "handleBrowserDNTRequest": false,
  
  // Retirer le crédit Tarteaucitron
  "removeCredit": true,
  
  // Lien "En savoir plus"
  "moreInfoLink": true,
  
  // CSS/JS externes
  "useExternalCss": false,
  "useExternalJs": false,
  
  // Lien "en savoir plus"
  "readmoreLink": "/mentions-legales#cookies",
  
  // Services obligatoires
  "mandatory": true,
  "mandatoryCta": true,
};

// Services à activer
export const tarteaucitronServices = {
  // Google Analytics (optionnel)
  googleAnalytics: {
    enabled: true, // Service de statistiques (optionnel)
    id: 'G-XXXXXXXXXX' // Remplacer par ton vrai ID Google Analytics
  },
  
  // Stripe (obligatoire pour paiements)
  stripe: {
    enabled: true
  },
  
  // YouTube (si tu embeddes des vidéos)
  youtube: {
    enabled: false
  },
  
  // Google Maps (si tu affiches une carte)
  googleMaps: {
    enabled: false,
    apiKey: '' // Ta clé API si besoin
  }
};