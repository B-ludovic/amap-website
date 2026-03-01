'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, Search, Users, ShoppingCart, Mail, Newspaper, Loader } from 'lucide-react';
import api from '../../lib/api';

const CATEGORY_CONFIG = {
  users:         { label: 'Utilisateurs',  icon: Users,       href: '/admin/utilisateurs' },
  subscriptions: { label: 'Abonnements',   icon: ShoppingCart, href: '/admin/abonnements' },
  messages:      { label: 'Messages',      icon: Mail,        href: '/admin/messages' },
  newsletters:   { label: 'Newsletters',   icon: Newspaper,   href: '/admin/communication' },
};

function resultLabel(category, item) {
  if (category === 'users')         return `${item.firstName} ${item.lastName} — ${item.email}`;
  if (category === 'subscriptions') return `${item.subscriptionNumber} — ${item.user.firstName} ${item.user.lastName}`;
  if (category === 'messages')      return `${item.name} — ${item.subject}`;
  if (category === 'newsletters')   return item.subject;
  return '';
}

export default function AdminHeader() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Badge notifications
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
        // silencieux
      }
    }
    fetchNotifCount();
    window.addEventListener('contact-unread-changed', fetchNotifCount);
    return () => window.removeEventListener('contact-unread-changed', fetchNotifCount);
  }, []);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche avec debounce
  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults(null);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const res = await api.admin.search(q.trim());
      setResults(res.data);
      setShowDropdown(true);
    } catch {
      setResults(null);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 300);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setQuery('');
    }
  }

  function handleResultClick(href) {
    setShowDropdown(false);
    setQuery('');
    router.push(href);
  }

  const hasResults = results && Object.values(results).some(arr => arr.length > 0);

  return (
    <header className="admin-header">
      <div className="admin-header-content">

        {/* Search */}
        <div className="admin-search-wrapper" ref={wrapperRef}>
          <div className="admin-header-search">
            {searching ? <Loader size={18} className="admin-search-spinner" /> : <Search size={18} />}
            <input
              type="search"
              placeholder="Rechercher…"
              className="admin-search-input"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              onFocus={() => results && setShowDropdown(true)}
              autoComplete="new-password"
              data-form-type="other"
              data-lpignore="true"
            />
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="admin-search-dropdown">
              {!hasResults ? (
                <p className="admin-search-empty">Aucun résultat pour &laquo;&nbsp;{query}&nbsp;&raquo;</p>
              ) : (
                Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const items = results[key];
                  if (!items?.length) return null;
                  const Icon = config.icon;
                  return (
                    <div key={key} className="admin-search-group">
                      <p className="admin-search-group-title">
                        <Icon size={13} /> {config.label}
                      </p>
                      {items.map(item => (
                        <button
                          key={item.id}
                          className="admin-search-result"
                          onClick={() => handleResultClick(config.href)}
                        >
                          {resultLabel(key, item)}
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="admin-header-actions">
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
