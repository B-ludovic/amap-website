'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import NewsletterModal from '../../../components/admin/NewsletterModal';
import AdminPagination from '../../../components/admin/AdminPagination';
import { longDate, plural } from '../../../lib/format';
import '../../../styles/admin/communication-da.css';

const TYPE_LABELS = {
  GENERAL: 'Général',
  WEEKLY_BASKET: 'Panier',
  RECIPE: 'Recette',
  ALERT: 'Alerte',
  PRODUCER_NEWS: 'Producteurs'
};

const TARGET_LABELS = {
  ALL: 'Tous les adhérents',
  ACTIVE_SUBSCRIBERS: 'Abonnés actifs',
  SOLIDARITY: 'Tarif solidaire',
  TEST: 'Test'
};

/* L'état est désormais une colonne, et c'est elle qui fait foi.

   Il se déduisait des dates : sentAt posé valait « envoyée ». Cela ne suffit
   plus depuis que l'envoi se poursuit après la réponse du serveur — sentAt est
   posé au départ de la diffusion, pas à son terme, si bien qu'une lettre en
   cours d'acheminement se serait annoncée partie. Le serveur tient donc un
   statut explicite, et c'est ce que cet écran lit.

   « Échec » est un état de départ comme « Brouillon » : la lettre reste
   modifiable et se renvoie, ce que le libellé doit laisser entendre plutôt que
   de sonner comme une fin de course. */
function stateOf(newsletter) {
  if (newsletter.status === 'SENDING') return { label: 'Envoi en cours', tone: 'admin-badge-amber' };
  if (newsletter.status === 'SENT') return { label: 'Envoyée', tone: 'admin-badge-green' };
  if (newsletter.status === 'FAILED') return { label: 'Échec, à renvoyer', tone: 'admin-badge-red' };
  if (newsletter.scheduledFor) return { label: 'Programmée', tone: 'admin-badge-amber' };
  return { label: 'Brouillon', tone: '' };
}

/* Le contenu est stocké en HTML : on n'en garde que le texte pour l'aperçu.
   Certaines newsletters — celles que génère l'annonce de fermeture — sont des
   emails HTML complets, feuille de style comprise. Retirer les seules balises
   laisserait apparaître le CSS en clair : on supprime d'abord le contenu des
   blocs <style> et <script>, puis les balises. */
function previewOf(html) {
  return (html ?? '')
    .replace(/<(style|script|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AdminCommunicationPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [newsletters, setNewsletters] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const fetchAll = useCallback(async (wanted) => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.newsletters.getAll({ page: wanted }),
        api.newsletters.getStats()
      ]);
      setNewsletters(listRes.data.newsletters ?? listRes.data);
      if (listRes.data.pagination) setPagination(listRes.data.pagination);
      setStats(statsRes.data);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchAll(page);
  }, [page, fetchAll]);

  const handleDelete = (newsletter) => {
    showConfirm(
      'Supprimer la newsletter',
      newsletter.sentAt
        ? `Supprimer « ${newsletter.subject} » ? Elle a déjà été envoyée, seule la trace en administration disparaîtra.`
        : `Supprimer « ${newsletter.subject} » ? Cette action est irréversible.`,
      async () => {
        try {
          await api.newsletters.delete(newsletter.id);
          showSuccess('Newsletter supprimée', 'La newsletter a été retirée.');
          fetchAll(page);
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const closeModal = (shouldRefresh) => {
    setEditing(null);
    if (shouldRefresh) fetchAll(page);
  };

  return (
    <div className="admin-comms">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Communication</h1>
          <p className="admin-title-lead">
            Newsletters aux adhérents — envoi immédiat, programmé ou brouillon.
          </p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={() => setEditing({ id: null })}>
          Nouvelle newsletter
        </button>
      </div>

      {stats && (
        <div className="admin-comms-stats">
          <div className="admin-comms-stat">
            <span className="admin-mono-label admin-comms-stat-label">Total</span>
            <div className="admin-comms-stat-value">{stats.total}</div>
          </div>
          <div className="admin-comms-stat">
            <span className="admin-mono-label admin-comms-stat-label">Envoyées</span>
            <div className="admin-comms-stat-value admin-comms-stat-value-sent">{stats.sent}</div>
          </div>
          <div className="admin-comms-stat">
            <span className="admin-mono-label admin-comms-stat-label">Programmées</span>
            <div className="admin-comms-stat-value admin-comms-stat-value-scheduled">{stats.scheduled}</div>
          </div>
          <div className="admin-comms-stat">
            <span className="admin-mono-label admin-comms-stat-label">Brouillons</span>
            <div className="admin-comms-stat-value admin-comms-stat-value-draft">{stats.draft}</div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : newsletters.length === 0 ? (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucune newsletter</p>
          <p className="admin-empty-card-note">Rien n&apos;a encore été rédigé.</p>
        </div>
      ) : (
        <div className="admin-comms-list">
          {newsletters.map((newsletter) => {
            const state = stateOf(newsletter);

            return (
              <article key={newsletter.id} className="admin-row-card admin-newsletter">
                <div>
                  <div className="admin-newsletter-head">
                    <h2 className="admin-newsletter-subject">{newsletter.subject}</h2>
                    <span className={`admin-badge ${state.tone}`}>{state.label}</span>
                    <span className="admin-badge admin-badge-ink">
                      {TYPE_LABELS[newsletter.type] ?? newsletter.type}
                    </span>
                  </div>

                  <p className="admin-newsletter-preview">{previewOf(newsletter.content)}</p>

                  <div className="admin-newsletter-meta">
                    <span>{TARGET_LABELS[newsletter.target] ?? newsletter.target}</span>
                    <span>
                      {newsletter.status === 'SENDING'
                        ? `Départ le ${longDate(newsletter.sentAt)}`
                        : newsletter.status === 'SENT'
                          ? `Envoyée le ${longDate(newsletter.sentAt)}`
                          : newsletter.scheduledFor
                            ? `Programmée le ${longDate(newsletter.scheduledFor)}`
                            : `Créée le ${longDate(newsletter.createdAt)}`}
                    </span>
                    {/* Le compteur avance lot par lot pendant la diffusion : on
                        l'affiche donc aussi en cours de route, en disant qu'il
                        n'est pas définitif. */}
                    {(newsletter.status === 'SENDING' || newsletter.status === 'SENT') && (
                      <span>
                        {newsletter.sentCount} {plural(newsletter.sentCount, 'destinataire', 'destinataires')}
                        {newsletter.status === 'SENDING' && ' pour l\'instant'}
                        {newsletter.openCount > 0 && ` · ${newsletter.openCount} ${plural(newsletter.openCount, 'ouverture', 'ouvertures')}`}
                      </span>
                    )}
                    {newsletter.author && (
                      <span className="admin-newsletter-author">
                        par {newsletter.author.firstName} {newsletter.author.lastName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="admin-newsletter-actions">
                  <button type="button" className="admin-btn-link" onClick={() => setEditing(newsletter)}>
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    className="admin-btn-link admin-btn-link-delete"
                    onClick={() => handleDelete(newsletter)}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AdminPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
      />

      {editing && (
        <NewsletterModal
          newsletter={editing.id ? editing : null}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
