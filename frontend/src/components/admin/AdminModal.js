'use client';

import { useEffect } from 'react';

/* Panneau modal commun à toutes les fiches de l'administration.
   La largeur suit la table MODAL_WIDTHS de la maquette : chaque vue passe la
   sienne en pixels, le panneau la lit comme variable CSS. */
export default function AdminModal({ title, width = '680px', onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="admin-modal-veil"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal"
        style={{ '--admin-modal-w': width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="admin-modal-head">
          <h2 className="admin-modal-title">{title}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );
}
