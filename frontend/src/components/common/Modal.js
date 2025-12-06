'use client';

import { useEffect } from 'react';
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
  // Fermer avec la touche Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Bouton fermer */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">
          <X size={24} />
        </button>

        {/* Icône */}
        <div className="modal-icon-container">
          {getIcon()}
        </div>

        {/* Contenu */}
        <div className="modal-content">
          {title && <h2 className="modal-title">{title}</h2>}
          {message && <p className="modal-message">{message}</p>}
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