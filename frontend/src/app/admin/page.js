'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import logger from '../../lib/logger';
import { longDayMonth, longDate, numericDate, euroRound, plural } from '../../lib/format';
import '../../styles/admin/dashboard.css';

const SUBSCRIPTION_STATUS = {
  ACTIVE: { label: 'Actif', tone: 'admin-badge-green' },
  PENDING: { label: 'En attente', tone: 'admin-badge-amber' },
  PAUSED: { label: 'En pause', tone: 'admin-badge-brown' },
  EXPIRED: { label: 'Expiré', tone: '' },
  CANCELLED: { label: 'Résilié', tone: 'admin-badge-red' }
};

const TYPE_LABELS = { ANNUAL: 'Annuel', DISCOVERY: 'Découverte' };
const SIZE_LABELS = { SMALL: 'Petit', LARGE: 'Grand' };

export default function AdminDashboard() {
  const { user } = useAuth();
  const { showError } = useModal();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.admin.stats.get();
        setData(response.data);
        setError(null);
      } catch (err) {
        logger.error('Erreur lors du chargement des statistiques:', err);
        setError(err.message);
        showError('Erreur', 'Impossible de charger les statistiques.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <p className="admin-empty">Chargement du tableau de bord…</p>;
  }

  if (error || !data) {
    return (
      <div className="admin-empty">
        <p>Impossible de charger les statistiques.</p>
        <button type="button" className="admin-btn-ghost" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    );
  }

  const { stats, recentActivities, nextDistribution } = data;
  const pendingTotal = stats.pendingRequests + stats.producerInquiries;

  /* Les tâches à compteur nul disparaissent : une liste qui annonce « traiter 0
     demande » donne du travail à lire pour rien. La vérification du panier reste
     en permanence, puisque le tirage est automatique et qu'il n'est jamais
     relu par personne autrement. */
  const todos = [
    stats.pendingRequests > 0 && {
      key: 'requests',
      href: '/admin/demandes-abonnements',
      label: `Traiter ${stats.pendingRequests} ${plural(stats.pendingRequests, 'demande', 'demandes')} d'abonnement`
    },
    stats.unreadMessages > 0 && {
      key: 'messages',
      href: '/admin/messages',
      label: `Répondre à ${stats.unreadMessages} ${plural(stats.unreadMessages, 'message non lu', 'messages non lus')}`
    },
    stats.producerInquiries > 0 && {
      key: 'inquiries',
      href: '/admin/demandes-producteurs',
      label: `Étudier ${stats.producerInquiries} ${plural(stats.producerInquiries, 'candidature producteur', 'candidatures producteurs')}`
    },
    nextDistribution && {
      key: 'basket',
      href: '/admin/panier-hebdomadaire',
      label: `Vérifier le panier de la semaine ${nextDistribution.weekNumber}`
    }
  ].filter(Boolean);

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-head">
        <h1 className="admin-title">Tableau de bord</h1>
        <p className="admin-title-lead">
          Bienvenue {user?.firstName}
          {nextDistribution
            ? ` — voici l'état de l'AMAP avant la distribution du ${longDate(nextDistribution.date)}.`
            : ' — voici l\'état de l\'AMAP.'}
        </p>
      </div>

      <div className="admin-tiles">
        <Link href="/admin/utilisateurs" className="admin-tile">
          <span className="admin-tile-label">Adhérents</span>
          <span className="admin-tile-value">{stats.users}</span>
          <span className="admin-tile-note">
            dont {stats.volunteers} {plural(stats.volunteers, 'bénévole', 'bénévoles')}
          </span>
        </Link>

        <Link href="/admin/abonnements" className="admin-tile">
          <span className="admin-tile-label">Abonnements</span>
          <span className="admin-tile-value">{stats.subscriptions}</span>
          <span className="admin-tile-note admin-tile-note-live">
            {stats.activeSubscriptions} {plural(stats.activeSubscriptions, 'actif', 'actifs')} · {stats.pausedSubscriptions} en pause
          </span>
        </Link>

        <Link href="/admin/producteurs" className="admin-tile">
          <span className="admin-tile-label">Producteurs</span>
          <span className="admin-tile-value">{stats.producers}</span>
          <span className="admin-tile-note">
            {stats.products} {plural(stats.products, 'produit référencé', 'produits référencés')}
          </span>
        </Link>

        <Link href="/admin/demandes-abonnements" className="admin-tile admin-tile-notice">
          <span className="admin-tile-label">Demandes en attente</span>
          <span className="admin-tile-value">{pendingTotal}</span>
          <span className="admin-tile-note">
            {stats.pendingRequests} {plural(stats.pendingRequests, 'abonnement', 'abonnements')} · {stats.producerInquiries} {plural(stats.producerInquiries, 'producteur', 'producteurs')}
          </span>
        </Link>

        <Link href="/admin/abonnements" className="admin-tile">
          <span className="admin-tile-label">Expirent sous 30 j</span>
          <span className="admin-tile-value">{stats.expiringSoon}</span>
          <span className="admin-tile-note">
            {plural(stats.expiringSoon, 'contrat à renouveler', 'contrats à renouveler')}
          </span>
        </Link>
      </div>

      <div className="admin-dashboard-split">
        <section className="admin-panel admin-activities">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">Activités récentes</h2>
            <Link href="/admin/abonnements" className="admin-btn-link admin-btn-link-muted">
              Tout voir
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <p className="admin-empty">Aucune activité récente.</p>
          ) : (
            <>
              <div className="admin-table-head">
                <span>Adhérent</span>
                <span>Type</span>
                <span>Taille</span>
                <span>Statut</span>
                <span className="admin-cell-right">Date</span>
              </div>
              {recentActivities.map((activity) => {
                const status = SUBSCRIPTION_STATUS[activity.status] ?? { label: activity.status, tone: '' };

                return (
                  <div key={activity.id} className="admin-table-row">
                    <span className="admin-cell-strong">
                      {activity.user?.firstName} {activity.user?.lastName}
                    </span>
                    <span className="admin-cell-muted">{TYPE_LABELS[activity.type] ?? activity.type}</span>
                    <span className="admin-cell-muted">{SIZE_LABELS[activity.basketSize] ?? activity.basketSize}</span>
                    <span>
                      <span className={`admin-badge ${status.tone}`}>{status.label}</span>
                    </span>
                    <span className="admin-cell-mono admin-cell-right">{numericDate(activity.createdAt)}</span>
                  </div>
                );
              })}
            </>
          )}
        </section>

        <div className="admin-dashboard-aside">
          <section className="admin-todo">
            <span className="admin-mono-label admin-todo-label">À faire cette semaine</span>
            {todos.length === 0 ? (
              <p className="admin-todo-empty">Rien en attente de traitement.</p>
            ) : (
              todos.map((todo) => (
                <Link key={todo.key} href={todo.href} className="admin-todo-item">
                  <span>{todo.label}</span>
                  <span className="admin-todo-arrow" aria-hidden="true">→</span>
                </Link>
              ))
            )}
          </section>

          {nextDistribution && (
            <section className="admin-next">
              <span className="admin-next-label">Prochaine distribution</span>
              <p className="admin-next-date">{longDayMonth(nextDistribution.date)}</p>
              <div className="admin-next-rows">
                <div className="admin-next-row">
                  <span className="admin-next-row-label">Paniers à préparer</span>
                  <span className="admin-next-row-value">{stats.activeSubscriptions}</span>
                </div>
                <div className="admin-next-row">
                  <span className="admin-next-row-label">Adhérents en pause</span>
                  <span className="admin-next-row-value">{stats.pausedSubscriptions}</span>
                </div>
                <div className="admin-next-row">
                  <span className="admin-next-row-label">Bénévoles inscrits</span>
                  {nextDistribution.shift ? (
                    <span
                      className={`admin-next-row-value${
                        nextDistribution.shift.registered < nextDistribution.shift.needed
                          ? ' admin-next-row-value-alert'
                          : ''
                      }`}
                    >
                      {nextDistribution.shift.registered} / {nextDistribution.shift.needed}
                    </span>
                  ) : (
                    <span className="admin-next-row-value admin-next-row-value-alert">
                      Non créée
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">Règlements — chèques encaissés</h2>
        </div>
        <div className="admin-settlements">
          <div className="admin-settlement">
            <span className="admin-mono-label admin-settlement-label">Encaissé</span>
            <div className="admin-settlement-value">{euroRound(stats.collected)}</div>
          </div>
          <div className="admin-settlement">
            <span className="admin-mono-label admin-settlement-label">Reste à encaisser</span>
            <div className="admin-settlement-value admin-settlement-value-due">{euroRound(stats.outstanding)}</div>
          </div>
          <div className="admin-settlement">
            <span className="admin-mono-label admin-settlement-label">Tarif solidaire</span>
            <div className="admin-settlement-value">
              {stats.solidarity} {plural(stats.solidarity, 'adhérent', 'adhérents')}
            </div>
          </div>
          <div className="admin-settlement">
            <span className="admin-mono-label admin-settlement-label">Sans règlement</span>
            <div className="admin-settlement-value admin-settlement-value-alert">{stats.withoutPayment}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
