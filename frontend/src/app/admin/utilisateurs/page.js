'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import { Search, UserCog, Trash2, Shield, User, Crown } from "lucide-react";


const ROLES = [
  { value: 'CUSTOMER', label: 'Client', icon: User, color: '#6b7280' },
  { value: 'PRODUCER', label: 'Producteur', icon: UserCog, color: '#10b981' },
  { value: 'ADMIN', label: 'Administrateur', icon: Crown, color: '#f59e0b' },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const { showConfirm, showSuccess, showError, showModal } = useModal();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.admin.users.getAll();
      setUsers(response.data.users);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = (user) => {
    const currentRole = ROLES.find(r => r.value === user.role);
    
    showModal({
      title: 'Changer le rôle',
      message: (
        <div className="role-modal-content">
          <p className="role-modal-user">
            Changer le rôle de <strong>{user.firstName} {user.lastName}</strong>
          </p>
          <p className="role-modal-current">
            Rôle actuel : <strong>{currentRole?.label}</strong>
          </p>
          <div className="role-select-list">
            {ROLES.map(role => {
              const Icon = role.icon;
              return (
                <button
                  key={role.value}
                  onClick={() => confirmRoleChange(user, role.value)}
                  className={`role-select-btn ${user.role === role.value ? 'role-select-btn-active' : ''}`}
                  data-color={role.color}
                >
                  <Icon size={20} className="role-select-icon" />
                  <span className="role-select-label">
                    {role.label}
                  </span>
                  {user.role === role.value && (
                    <span className="role-select-check">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ),
      type: 'info',
      confirmText: 'Fermer',
      onConfirm: () => {},
    });
  };

  const confirmRoleChange = async (user, newRole) => {
    if (user.role === newRole) return;

    const role = ROLES.find(r => r.value === newRole);
    
    showConfirm(
      'Confirmer le changement',
      `Êtes-vous sûr de vouloir changer le rôle de ${user.firstName} ${user.lastName} en ${role.label} ?`,
      async () => {
        try {
          await api.admin.users.changeRole(user.id, newRole);
          showSuccess('Rôle modifié', `Le rôle a été changé en ${role.label}.`);
          fetchUsers();
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const handleDeleteUser = (user) => {
    showConfirm(
      'Supprimer l\'utilisateur',
      `Êtes-vous sûr de vouloir supprimer ${user.firstName} ${user.lastName} ? Cette action est irréversible.`,
      async () => {
        try {
          await api.admin.users.delete(user.id);
          showSuccess('Utilisateur supprimé', `${user.firstName} ${user.lastName} a été supprimé avec succès.`);
          fetchUsers();
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !filterRole || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role) => {
    const roleData = ROLES.find(r => r.value === role);
    if (!roleData) return null;
    const Icon = roleData.icon;
    return <Icon size={16} className="user-role-icon" data-color={roleData.color} />;
  };

  const getRoleLabel = (role) => {
    return ROLES.find(r => r.value === role)?.label || role;
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <p>Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Utilisateurs</h1>
          <p className="admin-page-description">
            Gérez les utilisateurs et leurs rôles
          </p>
        </div>
      </div>

      <div className="admin-page-content">
        {/* Barre de recherche et filtres */}
        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={20} />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-search-input"
            />
          </div>

          <div className="admin-filters">
            <Shield size={20} />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="admin-filter-select"
            >
              <option value="">Tous les rôles</option>
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-toolbar-info">
            {filteredUsers.length} utilisateur(s)
          </div>
        </div>

        {/* Tableau */}
        {filteredUsers.length > 0 ? (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Rôle</th>
                  <th>Commandes</th>
                  <th>Inscription</th>
                  <th className="admin-table-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-table-name">
                        {user.firstName} {user.lastName}
                        {user.emailVerified && (
                          <span className="badge badge-success badge-sm">Vérifié</span>
                        )}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.phone || '-'}</td>
                    <td>
                      <div className="user-role-badge">
                        {getRoleIcon(user.role)}
                        <span>{getRoleLabel(user.role)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="admin-order-count">
                        {user._count?.orders || 0}
                      </span>
                    </td>
                    <td>
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          onClick={() => handleChangeRole(user)}
                          className="admin-action-btn admin-action-edit"
                          title="Changer le rôle"
                        >
                          <UserCog size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="admin-action-btn admin-action-delete"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state">
            <p>Aucun utilisateur trouvé</p>
            {(searchTerm || filterRole) && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setFilterRole('');
                }}
                className="btn btn-outline btn-sm"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}