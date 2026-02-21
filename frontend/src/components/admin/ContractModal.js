'use client';

import { useEffect, useState } from 'react';
import { X, Download, FileText, AlertCircle, Loader } from 'lucide-react';
import api from '../../lib/api';
import '../../styles/admin/components.css';

export default function ContractModal({ subscription, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let objectUrl = null;

    const fetchContract = async () => {
      try {
        setLoading(true);
        setError(null);
        objectUrl = await api.subscriptions.getContractBlobUrl(subscription.id);
        setBlobUrl(objectUrl);
      } catch (err) {
        setError(err.message || 'Impossible de générer le contrat');
      } finally {
        setLoading(false);
      }
    };

    fetchContract();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [subscription.id]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `Contrat_${subscription.subscriptionNumber}_${subscription.user?.lastName ?? ''}.pdf`;
    a.click();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} />
            <div>
              <h2>Contrat d'abonnement</h2>
              <p className="modal-subtitle">{subscription.subscriptionNumber}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {blobUrl && (
              <button className="btn btn-secondary" onClick={handleDownload}>
                <Download size={16} />
                Télécharger
              </button>
            )}
            <button className="modal-close" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0, maxHeight: '80vh' }}>
          {loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '48px',
              color: 'var(--text-secondary)'
            }}>
              <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
              <p>Génération du contrat en cours...</p>
            </div>
          )}

          {error && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '48px',
              color: 'var(--error-color)'
            }}>
              <AlertCircle size={32} />
              <p>{error}</p>
            </div>
          )}

          {blobUrl && !loading && (
            <iframe
              src={blobUrl}
              title={`Contrat ${subscription.subscriptionNumber}`}
              style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
