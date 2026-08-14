'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import { numericDate, longDate, plural } from '../../../lib/format';
import '../../../styles/admin/messages-da.css';

/* `status` est une colonne texte libre en base, documentée par un commentaire
   du schéma : UNREAD, READ, ARCHIVED. On s'en tient à ces trois valeurs. */
const STATUS = {
  UNREAD: { label: 'Non lu', tone: 'admin-badge-amber' },
  READ: { label: 'Lu', tone: 'admin-badge-green' },
  ARCHIVED: { label: 'Archivé', tone: '' }
};

const FILTERS = [
  { key: 'UNREAD', label: 'Non lus' },
  { key: 'READ', label: 'Lus' },
  { key: 'ARCHIVED', label: 'Archivés' },
  { key: 'ALL', label: 'Tous' }
];

export default function AdminMessagesPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);

  const fetchMessages = useCallback(async (status) => {
    setLoading(true);
    try {
      const [listRes, allRes] = await Promise.all([
        api.contactMessages.getAll(status === 'ALL' ? {} : { status }),
        status === 'ALL' ? Promise.resolve(null) : api.contactMessages.getAll({})
      ]);

      const list = listRes.data.messages;
      const all = allRes ? allRes.data.messages : list;

      setMessages(list);
      setTotal(all.length);
      setUnread(all.filter(message => message.status === 'UNREAD').length);
      setSelected(current => list.find(message => message.id === current?.id) ?? list[0] ?? null);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les messages.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchMessages(filter);
  }, [filter, fetchMessages]);

  const changeStatus = async (message, status) => {
    try {
      await api.contactMessages.updateStatus(message.id, status);
      /* La barre latérale porte le compteur de non-lus : elle écoute cet
         événement pour se rafraîchir sans recharger la page. */
      window.dispatchEvent(new CustomEvent('contact-unread-changed'));
      fetchMessages(filter);
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  /* Ouvrir un message le marque comme lu : c'est l'acte de lecture qui change
     l'état, pas un bouton séparé. */
  const openMessage = (message) => {
    setSelected(message);
    if (message.status === 'UNREAD') {
      changeStatus(message, 'READ');
    }
  };

  const handleDelete = () => {
    const message = selected;
    showConfirm(
      'Supprimer le message',
      `Supprimer le message de ${message.name} ? Cette action est irréversible.`,
      async () => {
        try {
          await api.contactMessages.delete(message.id);
          window.dispatchEvent(new CustomEvent('contact-unread-changed'));
          showSuccess('Message supprimé', 'Le message a été retiré.');
          setSelected(null);
          fetchMessages(filter);
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  return (
    <div className="admin-messages">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Messages de contact</h1>
          <p className="admin-title-lead">
            {unread} {plural(unread, 'message non lu', 'messages non lus')} sur {total}.
          </p>
        </div>
      </div>

      <div className="admin-pills">
        {FILTERS.map(item => (
          <button
            key={item.key}
            type="button"
            className={`admin-pill ${filter === item.key ? 'admin-pill-active' : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : messages.length === 0 ? (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucun message</p>
          <p className="admin-empty-card-note">Rien à lire avec ce filtre.</p>
        </div>
      ) : (
        <div className="admin-messages-split">
          <div className="admin-panel">
            {messages.map((message) => {
              const status = STATUS[message.status] ?? { label: message.status, tone: '' };

              return (
                <button
                  key={message.id}
                  type="button"
                  className={`admin-message-entry ${selected?.id === message.id ? 'admin-message-entry-active' : ''}`}
                  onClick={() => openMessage(message)}
                >
                  <span className="admin-message-entry-top">
                    <span className="admin-message-entry-name">{message.name}</span>
                    <span className="admin-message-entry-date">{numericDate(message.createdAt)}</span>
                  </span>
                  <span className="admin-message-entry-subject">{message.subject}</span>
                  <span className="admin-message-entry-preview">{message.message}</span>
                  <span className="admin-message-entry-badge">
                    <span className={`admin-badge ${status.tone}`}>{status.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="admin-panel">
              <div className="admin-message-head">
                <h2 className="admin-message-subject">{selected.subject}</h2>
                <div className="admin-message-meta">
                  <span className="admin-message-meta-name">{selected.name}</span>
                  <span className="admin-message-meta-email">{selected.email}</span>
                  <span className="admin-message-meta-date">{longDate(selected.createdAt)}</span>
                </div>
              </div>

              <div className="admin-message-body">
                <p className="admin-message-text">{selected.message}</p>

                <div className="admin-message-actions">
                  <a
                    className="admin-message-reply"
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re : ${selected.subject}`)}`}
                  >
                    Répondre par email
                  </a>

                  <label htmlFor="admin-message-status" className="sr-only">Statut du message</label>
                  <select
                    id="admin-message-status"
                    className="admin-select"
                    value={selected.status}
                    onChange={(event) => changeStatus(selected, event.target.value)}
                  >
                    {Object.entries(STATUS).map(([value, item]) => (
                      <option key={value} value={value}>{item.label}</option>
                    ))}
                  </select>

                  <button type="button" className="admin-btn-danger" onClick={handleDelete}>
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
