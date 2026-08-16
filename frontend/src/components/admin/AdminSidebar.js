'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';

const MENU_ITEMS = [
  { title: 'Tableau de bord', path: '/admin', exact: true },
  { title: 'Utilisateurs', path: '/admin/utilisateurs' },
  { title: 'Demandes abonnements', path: '/admin/demandes-abonnements', badge: 'subscriptions' },
  { title: 'Abonnements', path: '/admin/abonnements' },
  { title: 'Trésorerie', path: '/admin/tresorerie' },
  { title: 'Demandes producteurs', path: '/admin/demandes-producteurs', badge: 'producers' },
  { title: 'Producteurs', path: '/admin/producteurs' },
  { title: 'Produits', path: '/admin/produits' },
  { title: 'Panier hebdomadaire', path: '/admin/panier-hebdomadaire' },
  { title: 'Distribution', path: '/admin/distribution' },
  { title: 'Permanences', path: '/admin/permanences' },
  { title: 'Messages', path: '/admin/messages', badge: 'messages' },
  { title: 'Communication', path: '/admin/communication' },
  { title: 'Suivi des emails', path: '/admin/emails' },
  { title: 'Fermetures AMAP', path: '/admin/fermetures' },
  { title: 'Journal d\'audit', path: '/admin/journal' },
  { title: 'Paramètres', path: '/admin/parametres' }
];

export default function AdminSidebar({ currentPath }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { showConfirm } = useModal();
  const [counts, setCounts] = useState({ messages: 0, subscriptions: 0, producers: 0 });

  useEffect(() => {
    const fetchUnreadCount = () => {
      api.contactMessages.getAll({ status: 'UNREAD' })
        .then(data => setCounts(prev => ({
          ...prev,
          messages: data.data.pagination?.total ?? data.data.messages?.length ?? 0
        })))
        .catch(() => {});
    };

    const fetchPendingCounts = () => {
      api.subscriptionRequests.getAll({ status: 'PENDING' })
        .then(data => setCounts(prev => ({ ...prev, subscriptions: data.data?.requests?.length ?? 0 })))
        .catch(() => {});
      api.producerInquiries.getAll({ status: 'PENDING' })
        .then(data => setCounts(prev => ({ ...prev, producers: data.data?.inquiries?.length ?? 0 })))
        .catch(() => {});
    };

    fetchUnreadCount();
    fetchPendingCounts();
    window.addEventListener('contact-unread-changed', fetchUnreadCount);
    return () => window.removeEventListener('contact-unread-changed', fetchUnreadCount);
  }, []);

  const handleLogout = () => {
    showConfirm(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      () => {
        logout();
        router.push('/');
      }
    );
  };

  const isActive = (item) => (
    item.exact ? currentPath === item.path : currentPath.startsWith(item.path)
  );

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-header">
        <Link href="/admin" className="admin-logo">
          <Image src="/icons/pea.png" alt="" width={30} height={30} />
          <span>
            <span className="admin-logo-text">Aux P&apos;tits Pois</span>
            <span className="admin-logo-kicker">Administration</span>
          </span>
        </Link>
      </div>

      <nav className="admin-sidebar-nav" aria-label="Navigation de l'administration">
        {MENU_ITEMS.map((item) => {
          const count = item.badge ? counts[item.badge] : 0;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`admin-nav-item ${isActive(item) ? 'admin-nav-item-active' : ''}`}
              aria-current={isActive(item) ? 'page' : undefined}
            >
              <span>{item.title}</span>
              {count > 0 && <span className="admin-nav-count">{count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <Link href="/">
          <span className="admin-sidebar-back-arrow" aria-hidden="true">←</span>
          <span>Retour au site</span>
        </Link>
        <button type="button" onClick={handleLogout}>Déconnexion</button>
      </div>
    </aside>
  );
}
