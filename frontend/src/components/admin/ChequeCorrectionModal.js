'use client';

/* Correction d'un chèque — la marche arrière.

   Avancer un chèque suit le trajet du papier et ne demande rien : il quitte la
   pochette pour la banque, la banque pour le compte. Revenir en arrière, ou
   constater un rejet, c'est autre chose : on retire de l'argent au contrat ou on
   efface un fait déjà consigné. D'où le mot de passe.

   Ce qu'il prouve, et ce qu'il ne prouve pas : il établit que la personne devant
   le clavier est bien celle de la session, et non quelqu'un qui a ramassé la
   tablette restée déverrouillée sur la table d'une permanence. Il n'identifie
   personne de plus que la session ne le fait déjà — et derrière un compte
   partagé entre plusieurs bénévoles, il ne dit rien du tout sur l'auteur. */

import { useState } from 'react';
import AdminModal from './AdminModal';
import api from '../../lib/api';
import { euro, numericDate } from '../../lib/format';

/* Les destinations possibles, décrites par le lieu où se trouve le chèque
   plutôt que par un état abstrait. */
const DESTINATIONS = [
  { value: 'RECEIVED', label: 'En main', detail: 'le chèque est dans la pochette, rien n’est parti en banque' },
  { value: 'DEPOSITED', label: 'Déposé', detail: 'remis en banque, encaissement en attente' },
  { value: 'SUCCEEDED', label: 'Encaissé', detail: 'la somme est arrivée sur le compte' },
  { value: 'FAILED', label: 'Rejeté', detail: 'sans provision — le contrat redevient dû d’autant' },
  { value: 'RETURNED', label: 'Rendu', detail: 'restitué à l’adhérent, contrat annulé' }
];

export default function ChequeCorrectionModal({ subscriptionId, cheque, onClose, onCorrected }) {
  const [status, setStatus] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const destinations = DESTINATIONS.filter((d) => d.value !== cheque.status);

  const corriger = async () => {
    setError('');
    setBusy(true);
    try {
      await api.subscriptions.updateCheque(subscriptionId, cheque.id, { status, password });
      onCorrected();
    } catch (err) {
      /* Le mot de passe reste saisi : un trésorier qui se trompe de touche ne
         doit pas avoir à reprendre tout le formulaire. */
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal title="Corriger un chèque" width="520px" onClose={onClose}>
      <dl className="def-list admin-sub-follow">
        <div className="def-row">
          <dt className="def-label">Chèque</dt>
          <dd className="def-value">
            {euro(cheque.amount)}
            {cheque.checkNumber ? ` · n° ${cheque.checkNumber}` : ''}
            {' · échéance '}{numericDate(cheque.dueDate)}
          </dd>
        </div>
        <div className="def-row">
          <dt className="def-label">État actuel</dt>
          <dd className="def-value">
            {DESTINATIONS.find((d) => d.value === cheque.status)?.label ?? cheque.status}
          </dd>
        </div>
      </dl>

      <div className="admin-cheques-field">
        <span className="admin-field-label">Où se trouve réellement ce chèque ?</span>
        <div className="admin-cheques-destinations">
          {destinations.map(({ value, label, detail }) => (
            <button
              key={value}
              type="button"
              className={`admin-cheques-destination ${status === value ? 'is-active' : ''}`}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              <span className="admin-cheques-destination-label">{label}</span>
              <span className="admin-cheques-destination-detail">{detail}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-cheques-field">
        <label className="admin-field-label" htmlFor="cheque-password">
          Votre mot de passe
        </label>
        <input
          id="cheque-password"
          type="password"
          className="admin-input"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && status && password && !busy) corriger();
          }}
        />
        <p className="admin-cheques-preview">
          Une correction modifie ce que l&apos;association déclare détenir. Le journal
          en garde la trace, réussie comme refusée.
        </p>
      </div>

      {error && <p className="admin-cheques-alert">{error}</p>}

      <div className="admin-modal-actions">
        <button
          type="button"
          className="admin-btn-primary"
          onClick={corriger}
          disabled={busy || !status || !password}
        >
          {busy ? 'Enregistrement…' : 'Enregistrer la correction'}
        </button>
        <button type="button" className="admin-btn-ghost" onClick={onClose} disabled={busy}>
          Annuler
        </button>
      </div>
    </AdminModal>
  );
}
