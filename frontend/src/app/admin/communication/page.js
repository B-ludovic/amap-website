'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import NewsletterModal from "../../../components/admin/NewsletterModal";
import "../../../styles/admin/components.css";
import "../../../styles/admin/dashboard.css";
import "../../../styles/admin/layout.css";
import "../../../styles/admin/communication.css";
import {
    Mail,
    Send,
    Clock,
    Users,
    Plus,
    Edit2,
    Trash2,
    Eye
} from "lucide-react";

export default function AdminCommunicationPage() {
    const [newsletters, setNewsletters] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedNewsletter, setSelectedNewsletter] = useState(null);
    const [filter, setFilter] = useState('all');

    const { showModal } = useModal();

    useEffect(() => {
        fetchNewsletters();
    }, [filter]);

    const fetchNewsletters = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (filter === 'sent') {
        params.sent = 'true';
      } else if (filter === 'draft') {
        params.sent = 'false';
      }
      
      const response = await api.newsletters.getAll(params);
      setNewsletters(response.data.newsletters);
    } catch (error) {
      showModal('Erreur lors du chargement des newsletters', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.newsletters.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const handleCreate = () => {
    setSelectedNewsletter(null);
    setIsModalOpen(true);
  };

  const handleEdit = (newsletter) => {
    setSelectedNewsletter(newsletter);
    setIsModalOpen(true);
  };

  const handleDelete = async (newsletterId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette newsletter ?')) {
      return;
    }

    try {
      await api.newsletters.delete(newsletterId);
      showModal('Newsletter supprimée avec succès', 'success');
      fetchNewsletters();
      fetchStats();
    } catch (error) {
      showModal(error.response?.data?.message || 'Erreur lors de la suppression', 'error');
    }
  };

  const handleSend = async (newsletterId) => {
    if (!confirm('Êtes-vous sûr de vouloir envoyer cette newsletter maintenant ?')) {
      return;
    }

    try {
      const response = await api.newsletters.send(newsletterId);
      showModal(`Newsletter envoyée à ${response.data.sentCount} destinataire(s)`, 'success');
      fetchNewsletters();
      fetchStats();
    } catch (error) {
      showModal(error.response?.data?.message || 'Erreur lors de l\'envoi', 'error');
    }
  };

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false);
    setSelectedNewsletter(null);
    if (shouldRefresh) {
      fetchNewsletters();
      fetchStats();
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeBadge = (type) => {
    const types = {
      GENERAL: { label: 'Général', color: 'secondary' },
      WEEKLY_BASKET: { label: 'Panier hebdo', color: 'success' },
      RECIPE: { label: 'Recette', color: 'warning' },
      ALERT: { label: 'Alerte', color: 'error' },
      PRODUCER_NEWS: { label: 'Producteurs', color: 'info' }
    };
    
    const typeInfo = types[type] || types.GENERAL;
    return <span className={`badge badge-${typeInfo.color}`}>{typeInfo.label}</span>;
  };

  const getTargetBadge = (target) => {
    const targets = {
      ALL: 'Tous',
      ACTIVE_SUBSCRIBERS: 'Abonnés actifs',
      SOLIDARITY: 'Tarif solidaire',
      TEST: 'Test'
    };
    
    return <span className="badge">{targets[target] || target}</span>;
  };

  if (loading && !stats) {
    return <div className="loading-state">Chargement...</div>;
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Communication</h1>
          <p className="page-subtitle">Gérez vos newsletters et communications</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          <Plus size={20} />
          Nouvelle newsletter
        </button>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--primary-light)' }}>
              <Mail size={24} color="var(--primary-color)" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total newsletters</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>
              <Send size={24} color="#16a34a" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.sent}</div>
              <div className="stat-label">Envoyées</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7' }}>
              <Clock size={24} color="#ca8a04" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.scheduled}</div>
              <div className="stat-label">Programmées</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e0e7ff' }}>
              <Edit2 size={24} color="#4f46e5" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.draft}</div>
              <div className="stat-label">Brouillons</div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="toolbar">
        <div className="toolbar-filters">
          <button
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            Toutes
          </button>
          <button
            className={`btn ${filter === 'sent' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('sent')}
          >
            Envoyées
          </button>
          <button
            className={`btn ${filter === 'draft' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('draft')}
          >
            Brouillons
          </button>
        </div>
      </div>

      {/* Liste des newsletters */}
      {loading ? (
        <div className="loading-state">Chargement...</div>
      ) : newsletters.length === 0 ? (
        <div className="empty-state">
          <Mail size={48} />
          <h3>Aucune newsletter</h3>
          <p>Commencez par créer votre première newsletter</p>
          <button className="btn btn-primary" onClick={handleCreate}>
            <Plus size={20} />
            Nouvelle newsletter
          </button>
        </div>
      ) : (
        <div className="newsletters-list">
          {newsletters.map((newsletter) => (
            <div key={newsletter.id} className="newsletter-card">
              <div className="newsletter-card-header">
                <div className="newsletter-info">
                  <h3>{newsletter.subject}</h3>
                  <div className="newsletter-meta">
                    {getTypeBadge(newsletter.type)}
                    {getTargetBadge(newsletter.target)}
                    {newsletter.sentAt && (
                      <span className="newsletter-date">
                        Envoyée le {formatDate(newsletter.sentAt)}
                      </span>
                    )}
                    {!newsletter.sentAt && newsletter.scheduledFor && (
                      <span className="newsletter-date scheduled">
                        <Clock size={14} />
                        Programmée pour le {formatDate(newsletter.scheduledFor)}
                      </span>
                    )}
                    {!newsletter.sentAt && !newsletter.scheduledFor && (
                      <span className="newsletter-date draft">
                        Brouillon
                      </span>
                    )}
                  </div>
                </div>

                {newsletter.sentAt && newsletter.sentCount > 0 && (
                  <div className="newsletter-stats">
                    <div className="stat-item">
                      <Users size={16} />
                      <span>{newsletter.sentCount} envois</span>
                    </div>
                    {newsletter.openCount > 0 && (
                      <div className="stat-item">
                        <Eye size={16} />
                        <span>{Math.round((newsletter.openCount / newsletter.sentCount) * 100)}% ouverture</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="newsletter-card-body">
                <p className="newsletter-preview">
                  {newsletter.content.substring(0, 150)}...
                </p>
                <div className="newsletter-author">
                  Par {newsletter.author.firstName} {newsletter.author.lastName}
                </div>
              </div>

              <div className="newsletter-card-actions">
                {!newsletter.sentAt && (
                  <>
                    <button
                      className="btn btn-icon"
                      onClick={() => handleEdit(newsletter)}
                      title="Modifier"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      className="btn btn-success"
                      onClick={() => handleSend(newsletter.id)}
                      title="Envoyer maintenant"
                    >
                      <Send size={18} />
                      Envoyer
                    </button>
                    <button
                      className="btn btn-icon btn-danger"
                      onClick={() => handleDelete(newsletter.id)}
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
                {newsletter.sentAt && (
                  <span className="badge badge-success">✓ Envoyée</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <NewsletterModal
          newsletter={selectedNewsletter}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}