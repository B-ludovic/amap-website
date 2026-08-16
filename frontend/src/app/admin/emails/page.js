'use client';

/* Le suivi des envois.

   EmailLog existait déjà, mais ne s'ouvrait qu'en SQL : une adresse morte y
   laissait sa ligne sans que personne la voie passer. Cet écran est l'endroit
   où le retour du relais devient lisible — ce qui est parti, ce qui n'est pas
   arrivé, et les adresses auxquelles on a cessé d'écrire. */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, MailWarning, Undo2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useModal } from '../../../contexts/ModalContext';
import api from '../../../lib/api';
import logger from '../../../lib/logger';
import AdminPagination from '../../../components/admin/AdminPagination';
import { numericDate, time } from '../../../lib/format';
import '../../../styles/admin/components.css';
import '../../../styles/admin/dashboard.css';
import '../../../styles/admin/kit.css';
import '../../../styles/admin/layout.css';
import '../../../styles/admin/emails.css';

const KIND_LABELS = {
  WELCOME:                          'Bienvenue',
  EMAIL_VERIFICATION:               'Vérification d\'adresse',
  ACCOUNT_ALREADY_EXISTS:           'Compte déjà existant',
  PASSWORD_RESET:                   'Mot de passe oublié',
  PASSWORD_CHANGED:                 'Mot de passe modifié',
  ACCOUNT_DELETED:                  'Compte supprimé',
  ROLE_CHANGED:                     'Rôle modifié',
  SUBSCRIPTION_REQUEST_CONFIRMATION:'Demande d\'abonnement reçue',
  SUBSCRIPTION_REQUEST_WAITLISTED:  'Demande en liste d\'attente',
  SUBSCRIPTION_REQUEST_REJECTED:    'Demande refusée',
  SUBSCRIPTION_CONFIRMATION:        'Abonnement activé',
  RENEWAL_REMINDER:                 'Rappel de renouvellement',
  SUBSCRIPTION_CANCELLATION:        'Abonnement annulé',
  SUBSCRIPTION_PAUSED:              'Pause enregistrée',
  SUBSCRIPTION_RESUMED:             'Abonnement repris',
  SUBSCRIPTION_EXPIRED:             'Abonnement échu',
  CHEQUE_DEPOSIT_NOTICE:            'Avis de dépôt de chèque',
  TREASURER_CHEQUE_DIGEST:          'Remise de chèques (trésorier)',
  SHIFT_CONFIRMATION:               'Permanence confirmée',
  SHIFT_CANCELLATION:               'Permanence annulée',
  SHIFT_WITHDRAWAL:                 'Désinscription permanence',
  WEEKLY_BASKET:                    'Panier de la semaine',
  NEWSLETTER:                       'Lettre d\'information',
  PRODUCER_INQUIRY_CONFIRMATION:    'Candidature reçue',
  PRODUCER_INQUIRY_ACCEPTED:        'Candidature acceptée',
  PRODUCER_INQUIRY_REJECTED:        'Candidature refusée',
  CONTACT_MESSAGE:                  'Message de contact',
};

/* Le vocabulaire du relais, traduit. « Rejet définitif » plutôt que
   « hard bounce » : l'écran est lu par des bénévoles, pas par des
   administrateurs de messagerie. */
const DELIVERY_LABELS = {
  DELIVERED:      { texte: 'Remis',             classe: 'admin-badge-green' },
  DEFERRED:       { texte: 'Différé',           classe: 'admin-badge-brown' },
  SOFT_BOUNCE:    { texte: 'Rejet passager',    classe: 'admin-badge-amber' },
  HARD_BOUNCE:    { texte: 'Rejet définitif',   classe: 'admin-badge-red' },
  BLOCKED:        { texte: 'Bloqué',            classe: 'admin-badge-red' },
  SPAM_COMPLAINT: { texte: 'Signalé indésirable', classe: 'admin-badge-red' },
};

const SUPPRESSION_LABELS = {
  HARD_BOUNCE: 'Rejet définitif',
  BLOCKED:     'Bloquée par le relais',
  MANUAL:      'Écartée à la main',
};

const FILTRES = [
  { cle: 'TOUS',     titre: 'Tous' },
  { cle: 'PROBLEME', titre: 'Non aboutis' },
  { cle: 'SENT',     titre: 'Partis' },
];

export default function AdminEmailsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showConfirm } = useModal();
  const router = useRouter();

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [resume, setResume] = useState(null);
  const [suppressions, setSuppressions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filtre, setFiltre] = useState('PROBLEME');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/admin/login');
    }
  }, [user, authLoading, router]);

  const charger = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);

      const params = { page, limit: 50 };
      if (filtre === 'PROBLEME') params.probleme = true;
      if (filtre === 'SENT') params.status = 'SENT';
      if (recherche.trim()) params.email = recherche.trim();

      const [journal, sommaire, ecartees] = await Promise.all([
        api.emails.getLogs(params),
        api.emails.getSummary(),
        api.emails.getSuppressions(),
      ]);

      setLogs(journal.data.logs);
      setPagination(journal.data.pagination);
      setResume(sommaire.data);
      setSuppressions(ecartees.data.suppressions);
    } catch (error) {
      logger.error('Erreur chargement suivi des emails:', error);
      setLoadError(error.message || 'Impossible de charger le suivi des envois.');
    } finally {
      setLoading(false);
    }
  }, [page, filtre, recherche]);

  useEffect(() => {
    if (user?.role === 'ADMIN') charger();
  }, [user, charger]);

  const reprendreLesEnvois = (suppression) => {
    showConfirm(
      'Reprendre les envois ?',
      `Les prochains messages repartiront vers ${suppression.email}. Si l'adresse est toujours morte, elle reviendra dans cette liste au premier rebond.`,
      async () => {
        try {
          await api.emails.liftSuppression(suppression.id);
          charger();
        } catch (error) {
          logger.error('Erreur levée de suppression:', error);
          setLoadError(error.message || 'L\'adresse n\'a pas pu être remise en circulation.');
        }
      }
    );
  };

  const rechercher = (event) => {
    event.preventDefault();
    setPage(1);
    charger();
  };

  if (authLoading || (loading && !resume)) {
    return <div className="admin-loading">Chargement...</div>;
  }

  if (loadError && !resume) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          <AlertCircle size={48} />
          <p>{loadError}</p>
          <button type="button" className="admin-btn-ghost" onClick={charger}>Réessayer</button>
        </div>
      </div>
    );
  }

  const nonAboutis = (resume?.refuses ?? 0) + (resume?.rebonds ?? 0);
  /* Aucun retour sur tout un mois d'envois : le webhook n'est pas branché, ou
     son secret ne correspond pas. Sans ce bandeau, l'écran afficherait zéro
     rebond et on le lirait comme une bonne nouvelle. */
  const webhookMuet = resume && resume.envoyes > 0 && resume.sansRetour === resume.envoyes;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">
            <MailWarning size={28} />
            Suivi des emails
          </h1>
          <p className="admin-page-description">
            Ce que le site a envoyé, et ce que le relais en a fait — sur les {resume?.fenetreJours ?? 30} derniers jours.
          </p>
        </div>
      </div>

      {webhookMuet && (
        <div className="emails-alerte">
          <AlertCircle size={18} aria-hidden="true" />
          <span>
            Aucun retour du relais sur la période : le webhook Brevo n&apos;est probablement pas
            configuré, ou son secret ne correspond pas à <code>BREVO_WEBHOOK_SECRET</code>.
            Les rebonds ne remontent pas.
          </span>
        </div>
      )}

      {loadError && resume && (
        <div className="emails-alerte">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="admin-tiles emails-tiles">
        <div className="admin-tile">
          <span className="admin-tile-label">Partis</span>
          <span className="admin-tile-value">{resume?.envoyes ?? 0}</span>
          <span className="admin-tile-note">confiés au relais</span>
        </div>

        <div className={`admin-tile ${nonAboutis > 0 ? 'admin-tile-notice' : ''}`}>
          <span className="admin-tile-label">Non aboutis</span>
          <span className="admin-tile-value">{nonAboutis}</span>
          <span className="admin-tile-note">{resume?.refuses ?? 0} refusés, {resume?.rebonds ?? 0} rejetés après coup</span>
        </div>

        <div className={`admin-tile ${(resume?.plaintes ?? 0) > 0 ? 'admin-tile-notice' : ''}`}>
          <span className="admin-tile-label">Indésirables</span>
          <span className="admin-tile-value">{resume?.plaintes ?? 0}</span>
          <span className="admin-tile-note">signalés par leur destinataire</span>
        </div>

        <div className="admin-tile">
          <span className="admin-tile-label">Sans retour</span>
          <span className="admin-tile-value">{resume?.sansRetour ?? 0}</span>
          <span className="admin-tile-note">partis, rien reçu du relais</span>
        </div>

        <div className={`admin-tile ${(resume?.supprimees ?? 0) > 0 ? 'admin-tile-notice' : ''}`}>
          <span className="admin-tile-label">Adresses écartées</span>
          <span className="admin-tile-value">{resume?.supprimees ?? 0}</span>
          <span className="admin-tile-note">plus aucun envoi</span>
        </div>
      </div>

      <section className="emails-section">
        <h2 className="emails-section-title">Adresses écartées des envois</h2>
        <p className="emails-section-note">
          Le relais les a déclarées mortes. Continuer à leur écrire n&apos;atteint personne et
          fait passer les messages de l&apos;AMAP pour du courrier indésirable. Une fois
          l&apos;adresse corrigée avec l&apos;adhérent, reprenez les envois.
        </p>

        {suppressions.length === 0 ? (
          <p className="admin-empty">Aucune adresse écartée. Tout part normalement.</p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Adresse</th>
                  <th scope="col">Motif</th>
                  <th scope="col">Dernier rejet</th>
                  <th scope="col">Détail du relais</th>
                  <th scope="col" className="admin-table-actions-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map((suppression) => (
                  <tr key={suppression.id}>
                    <td className="emails-adresse">{suppression.email}</td>
                    <td>
                      <span className="admin-badge admin-badge-red">
                        {SUPPRESSION_LABELS[suppression.reason] ?? suppression.reason}
                      </span>
                    </td>
                    <td className="emails-date">{numericDate(suppression.lastEventAt)}</td>
                    <td className="emails-detail">{suppression.detail || '—'}</td>
                    <td className="admin-table-actions">
                      <button
                        type="button"
                        className="admin-btn-ghost emails-btn-reprendre"
                        onClick={() => reprendreLesEnvois(suppression)}
                      >
                        <Undo2 size={14} aria-hidden="true" />
                        Reprendre les envois
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="emails-section">
        <h2 className="emails-section-title">Journal des envois</h2>

        <div className="emails-barre">
          <div className="emails-filtres">
            {FILTRES.map((item) => (
              <button
                key={item.cle}
                type="button"
                className={filtre === item.cle ? 'admin-btn-primary' : 'admin-btn-ghost'}
                onClick={() => { setFiltre(item.cle); setPage(1); }}
              >
                {item.titre}
              </button>
            ))}
          </div>

          <form className="emails-recherche" onSubmit={rechercher}>
            <label className="sr-only" htmlFor="emails-recherche">Rechercher une adresse</label>
            <input
              id="emails-recherche"
              type="search"
              placeholder="Rechercher une adresse"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
            />
            <button type="submit" className="admin-btn-ghost">Chercher</button>
          </form>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Destinataire</th>
                <th scope="col">Message</th>
                <th scope="col">Départ</th>
                <th scope="col">Arrivée</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">Aucun envoi pour ce filtre.</td>
                </tr>
              ) : (
                logs.map((log) => {
                  const arrivee = DELIVERY_LABELS[log.delivery];

                  return (
                    <tr key={log.id}>
                      <td className="emails-date">{numericDate(log.sentAt)} {time(log.sentAt)}</td>
                      <td className="emails-adresse">{log.to}</td>
                      <td>{KIND_LABELS[log.kind] ?? log.kind}</td>
                      <td>
                        {log.status === 'SENT' ? (
                          <span className="admin-badge admin-badge-green">Parti</span>
                        ) : (
                          <span className="admin-badge admin-badge-red" title={log.error ?? undefined}>Refusé</span>
                        )}
                      </td>
                      <td>
                        {arrivee
                          ? <span className={`admin-badge ${arrivee.classe}`}>{arrivee.texte}</span>
                          : <span className="emails-attente">En attente</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          page={pagination?.page ?? 1}
          totalPages={pagination?.totalPages}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
