import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Package } from 'lucide-react';
import { requestLoan, type Asset, type Loan } from '../api';

interface RequestLoanModalProps {
  asset: Asset;
  onClose: () => void;
  onRequested: (loan: Loan) => void;
}

const RequestLoanModal = ({ asset, onClose, onRequested }: RequestLoanModalProps) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessories = asset.accessories || [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const loan = await requestLoan(asset.id, reason);
      onRequested(loan);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
    }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Solicitar Préstamo</h2>
          <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '8px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{asset.unique_code}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{asset.description}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{asset.brand_model}</div>
        </div>

        {accessories.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
              <Package size={14} /> Incluye:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {accessories.map((a, i) => <li key={i}>{a.name} {a.is_linked_asset && a.linked_asset_code ? `(QR: ${a.linked_asset_code})` : ''}</li>)}
            </ul>
          </div>
        )}

        <label>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Motivo de la solicitud</div>
          <textarea className="input-field" rows={3} required value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        {error && <p style={{ color: 'var(--danger-color)', fontSize: '0.9rem', marginTop: '12px' }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default RequestLoanModal;
