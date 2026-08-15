'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import logger from '../../../lib/logger';
import AdminPagination from '../../../components/admin/AdminPagination';
import { numericDate, time } from '../../../lib/format';
import '../../../styles/admin/components.css';
import '../../../styles/admin/dashboard.css';
import '../../../styles/admin/layout.css';
import '../../../styles/admin/journal.css';

const ACTION_LABELS = {
  DELETE_USER:                  'Suppression utilisateur',
  CHANGE_USER_ROLE:             'Changement de rôle',
  CREATE_PRODUCER:              'Ajout producteur',
  DELETE_PRODUCER:              'Suppression producteur',
  CREATE_PRODUCT:               'Ajout produit',
  DELETE_PRODUCT:               'Suppression produit',
  DELETE_CONTACT_MESSAGE:       'Suppression message',
  DELETE_EXAMPLES:              'Suppression exemples',
  APPROVE_SUBSCRIPTION_REQUEST: 'Validation demande abonnement',
  REJECT_SUBSCRIPTION_REQUEST:  'Refus demande abonnement',
  CANCEL_SUBSCRIPTION:          'Annulation abonnement',
  UPDATE_SUBSCRIPTION_STATUS:   'Mise à jour abonnement',
};

export default function AdminJournalPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/admin/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadLogs();
    }
  }, [user, severityFilter, page]);

  const loadLogs = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const params = { page, limit: 50 };
      if (severityFilter !== 'ALL') params.severity = severityFilter;
      const data = await api.admin.auditLogs.getAll(params);
      setLogs(data.data.logs);
      setPagination(data.data.pagination);
    } catch (error) {
      logger.error('Erreur chargement journal:', error);
      setLoadError(error.message || 'Impossible de charger le journal.');
    } finally {
      setLoading(false);
    }
  };

  const formatDetails = (details) => {
    if (!details) return '—';
    return Object.entries(details)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  };

  if (authLoading || loading) {
    return <div className="admin-loading">Chargement...</div>;
  }

  if (loadError) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          <AlertCircle size={48} />
          <p>{loadError}</p>
          <button type="button" className="admin-btn-ghost" onClick={loadLogs}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">
            <ShieldCheck size={28} />
            Historique des actions
          </h1>
          <p className="admin-page-description">
            Toutes les actions critiques et importantes effectuées par les administrateurs
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="journal-filters">
        {['ALL', 'CRITICAL', 'IMPORTANT'].map((s) => (
          <button
            key={s}
            className={severityFilter === s ? 'admin-btn-primary' : 'admin-btn-ghost'}
            onClick={() => { setSeverityFilter(s); setPage(1); }}
          >
            {s === 'ALL' ? 'Toutes' : s === 'CRITICAL' ? 'Critiques' : 'Importantes'}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Niveau</th>
              <th scope="col">Action</th>
              <th scope="col">Cible</th>
              <th scope="col">Admin</th>
              <th scope="col">Détails</th>
              <th scope="col">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="journal-empty">
                  Aucune entrée dans le journal
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="journal-date">{numericDate(log.createdAt)} {time(log.createdAt)}</td>
                  <td>
                    {log.severity === 'CRITICAL' ? (
                      <span className="status-badge status-cancelled journal-severity-critical">
                        <ShieldAlert size={12} />
                        Critique
                      </span>
                    ) : (
                      <span className="status-badge status-pending journal-severity-important">
                        <ShieldCheck size={12} />
                        Importante
                      </span>
                    )}
                  </td>
                  <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                  <td className="journal-target">
                    {log.targetLabel
                      ? (
                        <>
                          <span className="journal-target-label">{log.targetLabel}</span>
                          {log.targetType && (
                            <span className="journal-target-type"> ({log.targetType})</span>
                          )}
                        </>
                      )
                      : '—'
                    }
                  </td>
                  <td className="journal-admin">{log.adminEmail}</td>
                  <td className="journal-details">{formatDetails(log.details)}</td>
                  <td className="journal-ip">{log.ipAddress ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={pagination?.page ?? 1}
        totalPages={pagination?.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
