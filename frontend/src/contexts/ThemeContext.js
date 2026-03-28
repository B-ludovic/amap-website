'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import logger from '../lib/logger';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const response = await api.getActiveTheme();
      if (response.data?.theme) {
        setTheme(response.data.theme);
        applyTheme(response.data.theme);
      }
    } catch (error) {
      logger.log('Pas de thème personnalisé, utilisation du thème par défaut');
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (themeData) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', themeData.primaryColor);
      root.style.setProperty('--secondary-color', themeData.secondaryColor);
      root.style.setProperty('--accent-color', themeData.accentColor);
      root.style.setProperty('--background-color', themeData.backgroundColor);

      // Calcule automatiquement la couleur de texte accessible pour btn-primary
      const lum = (hex) => {
        const [r, g, b] = hex.replace('#', '').match(/.{2}/g)
          .map(v => { const c = parseInt(v, 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const cr = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const pl = lum(themeData.primaryColor);
      const btnText = cr(1.0, pl) >= cr(lum('#2d3748'), pl) ? '#ffffff' : '#2d3748';

      root.style.setProperty('--btn-primary-text', btnText);
      // Bouton en couleur primaire unie (évite les problèmes de contraste sur le dégradé secondaire)
      root.style.setProperty('--gradient-button', themeData.primaryColor);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, loadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
