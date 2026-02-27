'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, Search } from 'lucide-react';
import api from '../../lib/api';

export default function AdminHeader() {
  const { user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    async function fetchNotifCount() {
      try {
        const [statsRes, messagesRes] = await Promise.all([
          api.admin.stats.get(),
          api.contactMessages.getAll({ status: 'UNREAD' }),
        ]);
        const { pendingRequests = 0, producerInquiries = 0 } = statsRes.data.stats;
        const unread = messagesRes.data.messages.length ?? 0;
        setNotifCount(pendingRequests + producerInquiries + unread);
      } catch {
        // silencieux — le badge reste à 0
      }
    }

    fetchNotifCount();
    window.addEventListener('contact-unread-changed', fetchNotifCount);
    return () => window.removeEventListener('contact-unread-changed', fetchNotifCount);
  }, []);

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
            {notifCount > 0 && (
              <span className="admin-notification-badge">{notifCount}</span>
            )}
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