import { useState, useEffect } from 'react';
import { PackageCheck, Package } from 'lucide-react';
import { getLoans, returnLoan, type Loan } from '../api';
import { useModule } from '../moduleContext';
import UserProfileCard from '../components/UserProfileCard';
import { formatBogotaTime } from '../utils/dateUtils';

const Returns = () => {
  const { module } = useModule();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [conditions, setConditions] = useState<Record<number, string>>({});

  const load = () => {
    setLoading(true);
    getLoans()
      .then((loanData) => setLoans(loanData.filter(l => 
        l.asset.module === module && 
        (l.status === 'checked_out' || l.status === 'approved')
      )))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [module]);

  const handleReturn = async (loanId: number) => {
    if (!window.confirm("¿Seguro que querés registrar la devolución de este activo?")) return;
    
    setProcessingId(loanId);
    setError(null);
    try {
      await returnLoan(loanId, { 
        observations: notes[loanId] || undefined,
        condition_status: conditions[loanId] || 'BUENO'
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Devoluciones</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Activos actualmente prestados — registrá la devolución cuando la persona entregue el equipo.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : loans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          No hay activos pendientes de devolución en este módulo.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loans.map((loan) => (
            <div key={loan.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <UserProfileCard
                  user={loan.borrower}
                  subtitle={`Salió el ${formatBogotaTime(loan.checkout_date)}`}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <Package size={16} />
                  {loan.asset.description} <span style={{ opacity: 0.7 }}>({loan.asset.unique_code})</span>
                </div>
              </div>
              
              {loan.observations && (
                <div style={{ padding: '8px 12px', background: 'rgba(255,180,0,0.1)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>Observaciones Previas:</strong> {loan.observations}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="input-field"
                  style={{ width: '150px' }}
                  value={conditions[loan.id] || 'BUENO'}
                  onChange={(e) => setConditions({ ...conditions, [loan.id]: e.target.value })}
                >
                  <option value="BUENO">Buen estado</option>
                  <option value="DAÑADO">Dañado</option>
                  <option value="INCOMPLETO">Incompleto</option>
                  <option value="PERDIDO">Perdido</option>
                </select>
                <input
                  className="input-field"
                  style={{ flex: 1, minWidth: '220px' }}
                  placeholder="Observaciones de la devolución (opcional)"
                  value={notes[loan.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [loan.id]: e.target.value })}
                />
                <button
                  className="btn btn-primary"
                  disabled={processingId === loan.id}
                  onClick={() => handleReturn(loan.id)}
                >
                  <PackageCheck size={16} /> Registrar devolución
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Returns;
