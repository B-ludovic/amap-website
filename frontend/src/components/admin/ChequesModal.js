'use client';

/* Remise des chèques.

   C'est l'écran de la permanence : l'adhérent tend une enveloppe, on saisit ce
   qu'elle contient. Un seul geste pour toute la remise, et non un pointage
   chèque par chèque — le nombre suffit, le serveur en déduit les montants
   depuis le prix du contrat et les échéances depuis le calendrier de saison
   imprimé sur le contrat.

   C'est aussi cette action qui active le contrat. Elle remplace l'ancien
   « Activer », qui basculait le statut sans qu'aucun règlement ne soit
   enregistré en face : on pouvait livrer un panier par semaine à quelqu'un dont
   la base ne savait rien du paiement. */

import { useState, useEffect } from 'react';
import AdminModal from './AdminModal';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import { inputDate, euro } from '../../lib/format';
import logger from '../../lib/logger';

const MODALITES = [
  { value: '1', label: '1 chèque' },
  { value: '2', label: '2 chèques' },
  { value: '4', label: '4 chèques' }
];

export default function ChequesModal({ subscription, onClose, onRecorded }) {
  const { showError } = useModal();

  const [paymentType, setPaymentType] = useState('');
  const [receivedAt, setReceivedAt] = useState(inputDate(new Date()));
  const [checkNumbers, setCheckNumbers] = useState({});
  const [pricing, setPricing] = useState(null);
  const [busy, setBusy] = useState(false);

  /* La grille sert d'aperçu, pas de source : c'est le serveur qui découpe. On la
     lit pour que le trésorier confronte les montants annoncés au contenu de
     l'enveloppe avant de valider. */
  useEffect(() => {
    api.subscriptions.getPricing()
      .then((response) => setPricing(response.data.pricing))
      .catch((error) => logger.error('Erreur récupération grille tarifaire:', error));
  }, []);

  const cellule = pricing?.[subscription.type]?.[subscription.basketSize] ?? null;
  const solidaire = subscription.pricingType === 'SOLIDARITY';
  const prixGrille = solidaire ? cellule?.priceSolidarity : cellule?.price;

  /* Aperçu affiché seulement si le contrat suit la grille : un prix ajusté à la
     main ne se découpe pas comme elle l'annoncerait, et mieux vaut ne rien
     montrer qu'annoncer des montants que le serveur ne produira pas. */
  const surGrille = cellule !== null && prixGrille === subscription.price;
  const ventilation = surGrille && paymentType
    ? (solidaire ? cellule.installmentsSolidarity : cellule.installments)[paymentType]
    : null;

  const nombre = paymentType ? Number(paymentType) : 0;

  const enregistrer = async () => {
    setBusy(true);
    try {
      await api.subscriptions.recordCheques(subscription.id, {
        paymentType,
        receivedAt,
        checkNumbers: Array.from({ length: nombre }, (_, index) => checkNumbers[index] ?? '')
      });
      onRecorded();
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal title="Chèques reçus" width="560px" onClose={onClose}>
      <div className="admin-sub-identity">
        <span className="admin-sub-identity-ref">{subscription.subscriptionNumber}</span>
        <span className="admin-sub-identity-name">
          {subscription.user?.firstName} {subscription.user?.lastName}
        </span>
      </div>

      <dl className="def-list admin-sub-follow">
        <div className="def-row">
          <dt className="def-label">Montant du contrat</dt>
          <dd className="def-value">{euro(subscription.price)}</dd>
        </div>
      </dl>

      <div className="admin-cheques-field">
        <span className="admin-field-label">Combien de chèques l&apos;enveloppe contient-elle ?</span>
        <div className="admin-cheques-choice">
          {MODALITES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`admin-cheques-choice-btn ${paymentType === value ? 'is-active' : ''}`}
              aria-pressed={paymentType === value}
              onClick={() => setPaymentType(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* La phrase est celle imprimée sur le contrat, mot pour mot : c'est ce
            que l'adhérent a signé et ce qu'il doit y avoir dans l'enveloppe. */}
        {ventilation && <p className="admin-cheques-preview">{ventilation.text}</p>}

        {paymentType && !surGrille && (
          <p className="admin-cheques-preview">
            Le prix de ce contrat s&apos;écarte de la grille : la répartition sera calculée
            par le serveur à l&apos;enregistrement.
          </p>
        )}
      </div>

      <div className="admin-cheques-field">
        <label className="admin-field-label" htmlFor="cheques-received-at">Date de remise</label>
        <input
          id="cheques-received-at"
          type="date"
          className="admin-input"
          value={receivedAt}
          max={inputDate(new Date())}
          onChange={(event) => setReceivedAt(event.target.value)}
        />
      </div>

      {nombre > 0 && (
        <div className="admin-cheques-field">
          <span className="admin-field-label">Numéros des chèques — facultatif</span>
          <div className="admin-cheques-numbers">
            {Array.from({ length: nombre }, (_, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                className="admin-input"
                maxLength={20}
                placeholder={`Chèque ${index + 1}`}
                aria-label={`Numéro du chèque ${index + 1}`}
                value={checkNumbers[index] ?? ''}
                onChange={(event) => setCheckNumbers((prev) => ({ ...prev, [index]: event.target.value }))}
              />
            ))}
          </div>
        </div>
      )}

      {subscription.status === 'PENDING' && (
        <p className="admin-cheques-notice">
          Le contrat passera en <strong>actif</strong> : les paniers seront distribués
          à partir de la prochaine permanence.
        </p>
      )}

      <div className="admin-modal-actions">
        <button
          type="button"
          className="admin-btn-primary"
          onClick={enregistrer}
          disabled={busy || !paymentType}
        >
          {busy ? 'Enregistrement…' : 'Enregistrer la remise'}
        </button>
        <button type="button" className="admin-btn-ghost" onClick={onClose} disabled={busy}>
          Annuler
        </button>
      </div>
    </AdminModal>
  );
}
