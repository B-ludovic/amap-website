'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Modal from '../components/common/Modal';

const ModalContext = createContext();

export function ModalProvider({ children }) {
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // 'success', 'error', 'warning', 'info', 'confirm'
    confirmText: 'OK',
    cancelText: 'Annuler',
    onConfirm: null,
    onCancel: null,
  });

  /* Fonctions stables : des effets de chargement en dépendent, et une identité
     neuve à chaque modale les relancerait — en boucle si l'erreur ouvre la modale. */
  const showModal = useCallback(({
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    cancelText = 'Annuler',
    onConfirm = null,
    onCancel = null,
  }) => {
    setModal({
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
    });
  }, []);

  const closeModal = useCallback(() => {
    setModal(current => ({ ...current, isOpen: false }));
  }, []);

  const handleConfirm = () => {
    if (modal.onConfirm) {
      modal.onConfirm();
    }
    closeModal();
  };

  const handleCancel = () => {
    if (modal.onCancel) {
      modal.onCancel();
    }
    closeModal();
  };

  // Helpers pour différents types de modals
  const showSuccess = useCallback((title, message, onConfirm) => {
    showModal({ title, message, type: 'success', onConfirm });
  }, [showModal]);

  const showError = useCallback((title, message, onConfirm) => {
    showModal({ title, message, type: 'error', onConfirm });
  }, [showModal]);

  const showWarning = useCallback((title, message, onConfirm) => {
    showModal({ title, message, type: 'warning', onConfirm });
  }, [showModal]);

  const showConfirm = useCallback((title, message, onConfirm, onCancel) => {
    showModal({
      title,
      message,
      type: 'confirm',
      onConfirm,
      onCancel
    });
  }, [showModal]);

  const value = useMemo(() => ({
    showModal,
    showSuccess,
    showError,
    showWarning,
    showConfirm,
    closeModal,
  }), [showModal, showSuccess, showError, showWarning, showConfirm, closeModal]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={closeModal}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal doit être utilisé dans un ModalProvider');
  }
  return context;
}