import { useState, useEffect } from 'react';
import { Check, X, Clock, Package } from 'lucide-react';
import { getLoans, approveLoan, type Loan } from '../api';
import { useModule } from '../moduleContext';
import { getCachedUser } from '../components/LoginGate';
import UserProfileCard from '../components/UserProfileCard';

const Approvals = () => {
  const { module } = useModule();
  const currentUser = getCachedUser();
  const canApprove = currentUser?.role === 'encargado' || currentUser?.role === 'admin';
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [exitPass, setExitPass] = useState<Record<number, boolean>>({});

  const load = () => {
    setLoading(true);
    getLoans()
      .then((loanData) => setLoans(loanData.filter(l => l.asset.module === module)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [module]);

  const handleApproval = async (loanId: number, approve: boolean) => {
    setProcessingId(loanId);
    try {
      const updated = await approveLoan(loanId, approve, approve ? exitPass[loanId] || false : undefined);
      setLoans(loans.map(l => (l.id === loanId ? updated : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const statusLabel: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    checked_out: 'Entregado',
    returned: 'Devuelto',
  };

  const statusBadgeClass: Record<string, string> = {
    pending: 'badge-maintenance',
    approved: 'badge-available',
    rejected: 'badge-loaned',
    checked_out: 'badge-loaned',
    returned: 'badge-available',
  };

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">{canApprove ? 'Préstamos Pendientes' : 'Mis Solicitudes de Préstamo'}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {canApprove ? 'Revise las solicitudes de préstamo enviadas por el personal.' : 'Seguimiento de tus préstamos solicitados.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          Cargando solicitudes...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>
          Error: {error}
        </div>
      ) : loans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          No hay solicitudes de préstamo registradas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loans.map(loan => (
            <div key={loan.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
                    {loan.asset.description} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 400 }}>({loan.asset.unique_code})</span>
                  </h3>
                  <span className={`badge ${statusBadgeClass[loan.status]}`}>
                    {statusLabel[loan.status]}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <UserProfileCard
                    user={loan.borrower}
                    subtitle={`Solicitado el ${new Date(loan.request_date).toLocaleString('es-CO')}`}
                  />
                </div>
                {loan.reason && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '0.95rem', borderLeft: '3px solid var(--accent-color)' }}>
                    <strong>Motivo:</strong> "{loan.reason}"
                  </div>
                )}
                {(loan.asset.accessories || []).length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={14} />
                    Incluye: {(loan.asset.accessories || []).map(a => a.name).filter(Boolean).join(', ')}
                  </div>
                )}
              </div>

              {loan.status === 'pending' && canApprove ? (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                    disabled={processingId === loan.id}
                    onClick={() => handleApproval(loan.id, false)}
                  >
                    <X size={18} />
                    Rechazar
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={exitPass[loan.id] || false}
                        onChange={(e) => setExitPass(prev => ({ ...prev, [loan.id]: e.target.checked }))}
                      />
                      Requiere boleta de salida
                    </label>
                    <button
                      className="btn"
                      style={{ background: 'var(--success-color)', color: 'white' }}
                      disabled={processingId === loan.id}
                      onClick={() => handleApproval(loan.id, true)}
                    >
                      <Check size={18} />
                      Aprobar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} />
                  {loan.status === 'pending' ? 'Pendiente de revisión' : 'Procesado'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Approvals;
