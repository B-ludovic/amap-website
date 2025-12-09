'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

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
      console.log('Pas de thème personnalisé, utilisation du thème par défaut');
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
