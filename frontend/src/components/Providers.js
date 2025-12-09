'use client';

import { AuthProvider } from '../contexts/AuthContext';
import { ModalProvider } from '../contexts/ModalContext';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ModalProvider>
          {children}
        </ModalProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
