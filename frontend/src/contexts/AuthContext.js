'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    // Si aucune session connue, on ne fait pas la requête (évite un 401 en console)
    if (!localStorage.getItem('auth_known')) {
      setLoading(false);
      return;
    }
    try {
      const data = await authApi.me();
      setUser(data.data.user);
    } catch {
      localStorage.removeItem('auth_known');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    localStorage.setItem('auth_known', '1');
    setUser(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignorer les erreurs réseau
    } finally {
      localStorage.removeItem('auth_known');
      setUser(null);
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
