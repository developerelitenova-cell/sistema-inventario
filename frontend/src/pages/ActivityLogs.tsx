import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getActivityLogs, isMasterAdmin, type ActivityLog } from '../api';
import { Avatar } from '../components/UserProfileCard';
import { getCachedUser } from '../components/LoginGate';
import { formatBogotaTime } from '../utils/dateUtils';

const PAGE_SIZE = 100;

const ENTITY_LABELS: Record<string, string> = {
  user: 'Usuario', asset: 'Activo', loan: 'Préstamo', asset_request: 'Solicitud', assignment: 'Asignación',
};

const ActivityLogs = () => {
  const isMaster = isMasterAdmin(getCachedUser());
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const load = (offset: number) => {
    setLoading(true);
    getActivityLogs({ limit: PAGE_SIZE, offset })
      .then((data) => {
        setLogs(offset === 0 ? data : [...logs, ...data]);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredLogs = logs.filter(l =>
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    (l.actor?.full_name.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  if (!isMaster) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Registro de Actividad</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Auditoría de todas las acciones relevantes del sistema: quién hizo qué y cuándo.
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '20px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search size={18} style={{ color: 'var(--text-secondary)' }} />
        <input
          className="input-field"
          style={{ border: 'none', background: 'transparent', flex: 1 }}
          placeholder="Buscar por persona o acción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : filteredLogs.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No hay actividad registrada.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredLogs.map((log) => (
            <div key={log.id} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
              {log.actor ? <Avatar user={log.actor} size={32} /> : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--text-secondary)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem' }}>{log.description}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {formatBogotaTime(log.created_at)}
                  {log.entity_type && ` · ${ENTITY_LABELS[log.entity_type] || log.entity_type}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && filteredLogs.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={() => load(logs.length)}>Cargar más</button>
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Cargando...</div>}
    </div>
  );
};

export default ActivityLogs;
