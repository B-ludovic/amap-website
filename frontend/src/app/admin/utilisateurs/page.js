'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import { monthYear, longDate, phone, plural } from '../../../lib/format';
import '../../../styles/admin/users.css';

/* Les trois rôles du schéma Prisma. L'ancienne page listait CUSTOMER et
   PRODUCER, qui n'existent pas dans l'enum UserRole : le filtre ne rendait
   jamais rien et les libellés retombaient sur la valeur brute. */
const ROLES = [
  { value: 'MEMBER', label: 'Adhérent', tone: '' },
  { value: 'VOLUNTEER', label: 'Bénévole', tone: 'admin-badge-green' },
  { value: 'ADMIN', label: 'Administrateur', shortLabel: 'Admin', tone: 'admin-badge-brown' }
];

const PAGE_SIZE = 20;

function roleOf(value) {
  return ROLES.find(role => role.value === value);
}

export default function AdminUsersPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [draftRole, setDraftRole] = useState('MEMBER');
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef(null);

  const fetchUsers = useCallback(async ({ search: term, role: roleFilter, page: wanted }) => {
    setLoading(true);
    try {
      const response = await api.admin.users.getAll({
        page: wanted,
        limit: PAGE_SIZE,
        ...(roleFilter && { role: roleFilter }),
        ...(term && { search: term })
      });
      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  /* La recherche part vers le serveur après une pause de frappe : la liste est
     paginée, filtrer les seuls résultats déjà chargés donnerait un compte faux. */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers({ search, role, page });
    }, search ? 300 : 0);

    return () => clearTimeout(debounceRef.current);
  }, [search, role, page, fetchUsers]);

  const openUser = (user) => {
    setSelected(user);
    setDraftRole(user.role);
  };

  const handleSaveRole = async () => {
    if (!selected || draftRole === selected.role) {
      setSelected(null);
      return;
    }

    setSaving(true);
    try {
      await api.admin.users.changeRole(selected.id, draftRole);
      showSuccess('Rôle modifié', `${selected.firstName} ${selected.lastName} est désormais ${roleOf(draftRole)?.label.toLowerCase()}.`);
      setSelected(null);
      fetchUsers({ search, role, page });
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await api.auth.resendConfirmation(selected.email);
      showSuccess('Email envoyé', `Un nouvel email de vérification est parti vers ${selected.email}.`);
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  const handleDelete = () => {
    const user = selected;
    showConfirm(
      'Supprimer le compte',
      `Supprimer ${user.firstName} ${user.lastName} ? Cette action est irréversible.`,
      async () => {
        try {
          await api.admin.users.delete(user.id);
          showSuccess('Compte supprimé', `${user.firstName} ${user.lastName} a été supprimé.`);
          setSelected(null);
          fetchUsers({ search, role, page });
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <div className="admin-users">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Utilisateurs</h1>
          <p className="admin-title-lead">
            {pagination.total} {plural(pagination.total, 'compte', 'comptes')} — adhérents, bénévoles et administrateurs.
          </p>
        </div>
      </div>

      <div className="admin-toolbar-da">
        <label htmlFor="admin-users-search" className="sr-only">Rechercher un utilisateur</label>
        <input
          id="admin-users-search"
          type="text"
          className="admin-search-field"
          placeholder="Rechercher un utilisateur…"
          value={search}
          onChange={changeFilter(setSearch)}
        />

        <label htmlFor="admin-users-role" className="sr-only">Filtrer par rôle</label>
        <select
          id="admin-users-role"
          className="admin-select"
          value={role}
          onChange={changeFilter(setRole)}
        >
          <option value="">Tous les rôles</option>
          {ROLES.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>

        <span className="admin-toolbar-count">
          {pagination.total} {plural(pagination.total, 'compte', 'comptes')}
        </span>
      </div>

      <div className="admin-panel admin-users-table">
        <div className="admin-table-head">
          <span>Nom</span>
          <span>Email</span>
          <span className="admin-users-phone">Téléphone</span>
          <span>Rôle</span>
          <span>Abos</span>
          <span className="admin-users-since">Inscription</span>
          <span className="admin-cell-right">Action</span>
        </div>

        {loading ? (
          <p className="admin-empty">Chargement…</p>
        ) : users.length === 0 ? (
          <p className="admin-empty">Aucun utilisateur ne correspond à cette recherche.</p>
        ) : (
          users.map((user) => {
            const userRole = roleOf(user.role);

            return (
              <div key={user.id} className="admin-table-row">
                <span className="admin-cell-strong">{user.firstName} {user.lastName}</span>
                <span className="admin-cell-mono admin-users-email">{user.email}</span>
                <span className="admin-cell-mono admin-users-phone">{phone(user.phone)}</span>
                <span>
                  <span className={`admin-badge ${userRole?.tone ?? ''}`}>
                    {userRole?.shortLabel ?? userRole?.label ?? user.role}
                  </span>
                </span>
                <span className="admin-users-count">{user._count?.subscriptions ?? 0}</span>
                <span className="admin-cell-mono admin-users-since">{monthYear(user.createdAt)}</span>
                <span className="admin-cell-right">
                  <button type="button" className="admin-btn-link" onClick={() => openUser(user)}>
                    Ouvrir
                  </button>
                </span>
              </div>
            );
          })
        )}

        {pagination.totalPages > 1 && (
          <div className="admin-pager">
            <span className="admin-pager-state">
              Page {pagination.page} sur {pagination.totalPages}
            </span>
            <div className="admin-pager-controls">
              <button
                type="button"
                className="admin-btn-link"
                disabled={pagination.page <= 1}
                onClick={() => setPage(current => Math.max(1, current - 1))}
              >
                ← Précédent
              </button>
              <button
                type="button"
                className="admin-btn-link"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(current => current + 1)}
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <AdminModal title="Fiche utilisateur" width="560px" onClose={() => setSelected(null)}>
          <dl className="def-list admin-def">
            <div className="def-row">
              <dt className="def-label">Nom complet</dt>
              <dd className="def-value">{selected.firstName} {selected.lastName}</dd>
            </div>
            <div className="def-row">
              <dt className="def-label">Email</dt>
              <dd className="def-value def-value-mono">{selected.email}</dd>
            </div>
            <div className="def-row">
              <dt className="def-label">Téléphone</dt>
              <dd className="def-value def-value-mono">{phone(selected.phone)}</dd>
            </div>
            <div className="def-row">
              <dt className="def-label">Inscription</dt>
              <dd className="def-value def-value-mono">{longDate(selected.createdAt)}</dd>
            </div>
            <div className="def-row">
              <dt className="def-label">Email vérifié</dt>
              <dd className="def-value def-value-mono">{selected.emailVerified ? 'Oui' : 'Non'}</dd>
            </div>
            <div className="def-row">
              <dt className="def-label">Abonnements</dt>
              <dd className="def-value def-value-mono">{selected._count?.subscriptions ?? 0}</dd>
            </div>
          </dl>

          <div style={{ marginBottom: '26px' }}>
            <label htmlFor="admin-user-role" className="admin-field-label">Rôle</label>
            <select
              id="admin-user-role"
              className="admin-select-full"
              value={draftRole}
              onChange={(event) => setDraftRole(event.target.value)}
            >
              {ROLES.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn-primary" onClick={handleSaveRole} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {!selected.emailVerified && (
              <button type="button" className="admin-btn-ghost" onClick={handleResendVerification}>
                Renvoyer l&apos;email de vérification
              </button>
            )}
            <span className="admin-modal-actions-end">
              <button type="button" className="admin-btn-danger" onClick={handleDelete}>
                Supprimer le compte
              </button>
            </span>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
