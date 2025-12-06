'use client';

import { useAuth } from '../../contexts/AuthContext';
import { Bell, Search } from 'lucide-react';

export default function AdminHeader() {
  const { user } = useAuth();

  return (
    <header className="admin-header">
      <div className="admin-header-content">
        {/* Search */}
        <div className="admin-header-search">
          <Search size={20} />
          <input
            type="text"
            placeholder="Rechercher..."
            className="admin-search-input"
          />
        </div>

        {/* Actions */}
        <div className="admin-header-actions">
          {/* Notifications */}
          <button className="admin-header-icon-btn">
            <Bell size={20} />
            <span className="admin-notification-badge">3</span>
          </button>

          {/* User */}
          <div className="admin-header-user">
            <div className="admin-user-avatar">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="admin-user-info">
              <span className="admin-user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="admin-user-role">Administrateur</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}