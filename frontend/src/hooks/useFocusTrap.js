'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Piège le focus dans un conteneur (modale, drawer…).
 * - Déplace le focus sur le premier élément focusable à l'ouverture.
 * - Boucle Tab / Shift+Tab à l'intérieur du conteneur.
 * - Restaure le focus sur l'élément d'origine à la fermeture.
 *
 * @param {React.RefObject} containerRef — ref du conteneur à piéger
 */
export function useFocusTrap(containerRef) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    const getFocusable = () => [...container.querySelectorAll(FOCUSABLE_SELECTORS)];

    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [containerRef]);
}
