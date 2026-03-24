'use client';

import { useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import '../../styles/components/modal.css';

export default function Modal({
  isOpen,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
  onClose,
}) {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Mémoriser l'élément focusé avant l'ouverture
    previousFocusRef.current = document.activeElement;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Déplacer le focus dans la modale
    const firstFocusable = containerRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        containerRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { last.focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      // Rendre le focus à l'élément d'origine
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Icône selon le type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={48} className="modal-icon modal-icon-success" />;
      case 'error':
        return <AlertCircle size={48} className="modal-icon modal-icon-error" />;
      case 'warning':
        return <AlertTriangle size={48} className="modal-icon modal-icon-warning" />;
      case 'confirm':
        return <Info size={48} className="modal-icon modal-icon-confirm" />;
      default:
        return <Info size={48} className="modal-icon modal-icon-info" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} aria-hidden="true">
      <div
        ref={containerRef}
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={message ? 'modal-message' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Fermer la fenêtre">
          <X size={24} aria-hidden="true" />
        </button>

        {/* Icône */}
        <div className="modal-icon-container" aria-hidden="true">
          {getIcon()}
        </div>

        {/* Contenu */}
        <div className="modal-content">
          {title && <h2 id="modal-title" className="modal-title">{title}</h2>}
          {message && <div id="modal-message" className="modal-message">{message}</div>}
        </div>

        {/* Actions */}
        <div className="modal-actions">
          {type === 'confirm' ? (
            <>
              <button onClick={onCancel} className="btn btn-outline">
                {cancelText}
              </button>
              <button onClick={onConfirm} className="btn btn-primary">
                {confirmText}
              </button>
            </>
          ) : (
            <button onClick={onConfirm} className="btn btn-primary">
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}