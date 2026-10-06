import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { getActivityLogs, isMasterAdmin, type ActivityLog } from '../api';
import { Avatar } from '../components/UserProfileCard';
import { getCachedUser } from '../components/LoginGate';
import { formatBogotaTime } from '../utils/dateUtils';
import { exportToCsv } from '../utils/exportUtils';

const PAGE_SIZE = 100;

const ENTITY_LABELS: Record<string, string> = {
  user: 'Usuario',
  asset: 'Activo',
  loan: 'Préstamo',
  asset_request: 'Solicitud',
  assignment: 'Asignación',
};

const ActivityLogs = () => {
  const isMaster = isMasterAdmin(getCachedUser());
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
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

  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.description.toLowerCase().includes(search.toLowerCase()) ||
      (l.actor?.full_name.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      l.action.toLowerCase().includes(search.toLowerCase());
    const matchesEntity = selectedEntity === 'ALL' || l.entity_type === selectedEntity;
    return matchesSearch && matchesEntity;
  });

  const handleExportCsv = () => {
    exportToCsv<ActivityLog>(
      `auditoria_logs_${new Date().toISOString().split('T')[0]}`,
      [
        { header: 'ID', accessor: l => l.id },
        { header: 'Fecha y Hora (Bogotá)', accessor: l => formatBogotaTime(l.created_at) },
        { header: 'Usuario / Actor', accessor: l => l.actor?.full_name || 'Sistema' },
        { header: 'Acción', accessor: l => l.action },
        { header: 'Módulo / Entidad', accessor: l => ENTITY_LABELS[l.entity_type || ''] || l.entity_type || '' },
        { header: 'Descripción Detallada', accessor: l => l.description },
      ],
      filteredLogs
    );
  };

  if (!isMaster) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="animate-fade-in">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="title">Registro de Actividad</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Auditoría de todas las acciones relevantes del sistema: quién hizo qué y cuándo.
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={handleExportCsv}
          disabled={filteredLogs.length === 0}
          title="Descargar registro de auditoría en formato Excel"
        >
          <Download size={18} />
          Exportar Logs ({filteredLogs.length})
        </button>
      </div>

      <div className="glass-panel" style={{ marginBottom: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search size={18} style={{ color: 'var(--text-secondary)' }} />
        <input
          className="input-field"
          style={{ border: 'none', background: 'transparent', flex: 1 }}
          placeholder="Buscar por persona, acción o detalle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filtro por Módulo / Tipo de Entidad */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          className={`btn ${selectedEntity === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          onClick={() => setSelectedEntity('ALL')}
        >
          Todos los Módulos
        </button>
        {Object.entries(ENTITY_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`btn ${selectedEntity === key ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={() => setSelectedEntity(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : filteredLogs.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No hay actividad registrada con los filtros seleccionados.</div>
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
