'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
  { title: 'Demandes d\'accès', path: '/admin/acces-producteurs', badge: 'access' },
  { title: 'Producteurs', path: '/admin/producteurs' },
  { title: 'Produits', path: '/admin/produits' },
  { title: 'Panier hebdomadaire', path: '/admin/panier-hebdomadaire' },
  { title: 'Distribution', path: '/admin/distribution' },
  { title: 'Permanences', path: '/admin/permanences', badge: 'shifts' },
  { title: 'Messages', path: '/admin/messages', badge: 'messages' },
  { title: 'Communication', path: '/admin/communication' },
  { title: 'Suivi des emails', path: '/admin/emails' },
  { title: 'Fermetures AMAP', path: '/admin/fermetures' },
  { title: 'Journal d\'audit', path: '/admin/journal' },
  { title: 'Paramètres', path: '/admin/parametres' },
  { title: 'Aide', path: '/admin/aide' }
];

export default function AdminSidebar({ currentPath, isOpen, onClose }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { showConfirm } = useModal();
  const [counts, setCounts] = useState({ messages: 0, subscriptions: 0, producers: 0, access: 0, shifts: 0 });

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
      // Le total de la file, pas la longueur de sa première page.
      api.subscriptionRequests.getAll({ status: 'PENDING', limit: 1 })
        .then(data => setCounts(prev => ({ ...prev, subscriptions: data.data?.pagination?.total ?? 0 })))
        .catch(() => {});
      api.producerInquiries.getAll({ status: 'PENDING', limit: 1 })
        .then(data => setCounts(prev => ({ ...prev, producers: data.data?.pagination?.total ?? 0 })))
        .catch(() => {});
    };

    const fetchAccessCount = () => {
      api.producerAccessRequests.getAll({ status: 'PENDING', limit: 1 })
        .then(data => setCounts(prev => ({ ...prev, access: data.data?.pagination?.total ?? 0 })))
        .catch(() => {});
    };

    const fetchProposalCount = () => {
      api.shifts.getPendingProposals()
        .then(data => setCounts(prev => ({ ...prev, shifts: data.data?.length ?? 0 })))
        .catch(() => {});
    };

    fetchUnreadCount();
    fetchPendingCounts();
    fetchAccessCount();
    fetchProposalCount();
    window.addEventListener('contact-unread-changed', fetchUnreadCount);
    window.addEventListener('producer-access-changed', fetchAccessCount);
    window.addEventListener('shift-proposals-changed', fetchProposalCount);
    return () => {
      window.removeEventListener('contact-unread-changed', fetchUnreadCount);
      window.removeEventListener('producer-access-changed', fetchAccessCount);
      window.removeEventListener('shift-proposals-changed', fetchProposalCount);
    };
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
    <aside
      id="admin-sidebar"
      className={`admin-sidebar ${isOpen ? 'admin-sidebar-open' : ''}`}
    >
      <div className="admin-sidebar-header">
        <Link href="/admin" className="admin-logo">
          <Image src="/icons/pea.png" alt="" width={30} height={30} />
          <span>
            <span className="admin-logo-text">Aux P&apos;tits Pois</span>
            <span className="admin-logo-kicker">Administration</span>
          </span>
        </Link>
        <button
          type="button"
          className="admin-sidebar-close"
          onClick={onClose}
          aria-label="Fermer le menu d'administration"
        >
          <X aria-hidden="true" size={20} strokeWidth={2} />
        </button>
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
              onClick={onClose}
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
