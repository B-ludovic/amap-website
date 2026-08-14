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
      }
    } catch (error) {
      logger.log('Pas de thème personnalisé, utilisation du thème par défaut');
    } finally {
      setLoading(false);
    }
  };

  // Le thème administrable ne repeint plus l'interface : la direction artistique
  // (crème & terracotta) est figée dans styles/variables.css. Le thème actif reste
  // exposé pour l'écran d'administration, mais n'écrase plus aucune variable CSS.

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
