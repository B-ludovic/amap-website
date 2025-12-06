'use client';

import { createContext, useContext, useState } from 'react';
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

  const showModal = ({
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
  };

  const closeModal = () => {
    setModal({
      ...modal,
      isOpen: false,
    });
  };

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
  const showSuccess = (title, message, onConfirm) => {
    showModal({ title, message, type: 'success', onConfirm });
  };

  const showError = (title, message, onConfirm) => {
    showModal({ title, message, type: 'error', onConfirm });
  };

  const showWarning = (title, message, onConfirm) => {
    showModal({ title, message, type: 'warning', onConfirm });
  };

  const showConfirm = (title, message, onConfirm, onCancel) => {
    showModal({ 
      title, 
      message, 
      type: 'confirm', 
      onConfirm, 
      onCancel 
    });
  };

  const value = {
    showModal,
    showSuccess,
    showError,
    showWarning,
    showConfirm,
    closeModal,
  };

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