'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import "../../../styles/admin/components.css";
import "../../../styles/admin/dashboard.css";
import "../../../styles/admin/layout.css";
import "../../../styles/admin/distribution.css";
import "../../../styles/admin/messages.css";

export default function AdminMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/admin/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadData();
    }
  }, [user, filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.contactMessages.getAll(filter !== 'ALL' ? { status: filter } : {});
      setMessages(data.data.messages);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = messages.filter(m => m.status === 'UNREAD').length;

  const handleStatusChange = async (id, status) => {
    try {
      await api.contactMessages.updateStatus(id, status);
      loadData();
      if (selectedMessage?.id === id) {
        setSelectedMessage({ ...selectedMessage, status });
      }
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce message ?')) return;

    try {
      await api.contactMessages.delete(id);
      loadData();
      setSelectedMessage(null);
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleViewMessage = async (message) => {
    setSelectedMessage(message);
    if (message.status === 'UNREAD') {
      handleStatusChange(message.id, 'READ');
    }
  };

  if (authLoading || loading) {
    return <div className="admin-loading">Chargement...</div>;
  }

  return (
    <div className="admin-messages-page">
      <div className="messages-header">
        <h1>Messages de Contact</h1>
      </div>

      <div className="messages-filters">
        <button
          className={filter === 'ALL' ? 'active' : ''}
          onClick={() => setFilter('ALL')}
        >
          Tous
        </button>
        <button
          className={filter === 'UNREAD' ? 'active' : ''}
          onClick={() => setFilter('UNREAD')}
        >
          Non lus ({unreadCount})
        </button>
        <button
          className={filter === 'READ' ? 'active' : ''}
          onClick={() => setFilter('READ')}
        >
          Lus
        </button>
        <button
          className={filter === 'ARCHIVED' ? 'active' : ''}
          onClick={() => setFilter('ARCHIVED')}
        >
          Archivés
        </button>
      </div>

      <div className="messages-container">
        {/* Liste des messages */}
        <div className="messages-list">
          {messages.length === 0 ? (
            <div className="no-messages">Aucun message</div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`message-item ${message.status === 'UNREAD' ? 'unread' : ''} ${selectedMessage?.id === message.id ? 'active' : ''}`}
                onClick={() => handleViewMessage(message)}
              >
                <div className="message-item-header">
                  <strong>{message.name}</strong>
                  <span className="message-date">
                    {new Date(message.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="message-item-subject">{message.subject}</div>
                <div className="message-item-preview">
                  {message.message.substring(0, 100)}...
                </div>
                <div className="message-item-footer">
                  <span className={`status-badge ${message.status.toLowerCase()}`}>
                    {message.status === 'UNREAD' ? 'Non lu' : message.status === 'READ' ? 'Lu' : 'Archivé'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Détail du message */}
        {selectedMessage && (
          <div className="message-detail">
            <div className="message-detail-header">
              <h2>{selectedMessage.subject}</h2>
              <button
                className="btn-close"
                onClick={() => setSelectedMessage(null)}
              >
                ✕
              </button>
            </div>

            <div className="message-detail-info">
              <div className="info-row">
                <strong>De :</strong> {selectedMessage.name}
              </div>
              <div className="info-row">
                <strong>Email :</strong>
                <a href={`mailto:${selectedMessage.email}`}>{selectedMessage.email}</a>
              </div>
              <div className="info-row">
                <strong>Date :</strong>
                {new Date(selectedMessage.createdAt).toLocaleString('fr-FR')}
              </div>
            </div>

            <div className="message-detail-content">
              <p>{selectedMessage.message}</p>
            </div>

            <div className="message-detail-actions">
              <a
                href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}
                className="btn btn-primary"
              >
                Répondre
              </a>

              <select
                value={selectedMessage.status}
                onChange={(e) => handleStatusChange(selectedMessage.id, e.target.value)}
                className="status-select"
              >
                <option value="UNREAD">Non lu</option>
                <option value="READ">Lu</option>
                <option value="ARCHIVED">Archivé</option>
              </select>

              <button
                onClick={() => handleDelete(selectedMessage.id)}
                className="btn btn-danger"
              >
                Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
