import { useState, useEffect, type FormEvent } from 'react';
import { Search, Pencil, Send, Info, CornerDownLeft } from 'lucide-react';
import {
  getAssets, formatCOP, STATUS_LABELS, CATEGORY_LABELS,
  createAssetRequest, getMyAssetRequests, getAssetAvailability, INVENTORY_TYPE_LABELS,
  getLoans, getAssignments, getActivityLogs, returnAsset,
  type Asset, type Category, type AssetRequest, type AssetAvailability, type InventoryType,
  type Loan, type Assignment, type ActivityLog
} from '../api';
import { useModule } from '../moduleContext';
import { getCachedUser } from '../components/LoginGate';
import AssetEditModal from '../components/AssetEditModal';
import AssetViewModal from '../components/AssetViewModal';
import RequestLoanModal from '../components/RequestLoanModal';
import RequestCommentThread from '../components/RequestCommentThread';
import ReturnAssetModal from '../components/ReturnAssetModal';

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', assigned: 'Asignada', rejected: 'Rechazada',
};

const EmployeeRequestView = () => {
  const [category, setCategory] = useState<Category | ''>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<AssetAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [activeTab, setActiveTab] = useState<'request' | 'assets' | 'history'>('request');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const currentUser = getCachedUser();

  const load = () => {
    setLoading(true);
    Promise.all([
      getMyAssetRequests().then(setMyRequests),
      getLoans().then(setLoans),
      getAssignments().then(setAssignments),
      getActivityLogs({ actor_id: currentUser?.id }).then(setActivityLogs)
    ])
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!category) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setCheckingAvailability(true);
    getAssetAvailability(category)
      .then((result) => { if (!cancelled) setAvailability(result); })
      .catch(() => { if (!cancelled) setAvailability(null); })
      .finally(() => { if (!cancelled) setCheckingAvailability(false); });
    return () => { cancelled = true; };
  }, [category]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const resolvedModule = currentUser?.warehouses.length === 1 ? currentUser.warehouses[0].key : undefined;
      await createAssetRequest(category || undefined, description, resolvedModule);
      setDescription('');
      setCategory('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Panel de Usuario</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Gestioná tus solicitudes, activos a cargo y revisá tu historial.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'request' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('request')}
        >
          Solicitar Activo
        </button>
        <button
          className={`btn ${activeTab === 'assets' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('assets')}
        >
          Mis Activos a Cargo
        </button>
        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('history')}
        >
          Mi Historial
        </button>
      </div>

      {activeTab === 'request' && (
        <div className="animate-fade-in">
          <form onSubmit={handleSubmit} className="glass-panel" style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}>
            <label>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tipo de activo (opcional)</div>
              <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                <option value="">No estoy seguro / otro</option>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              {category && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  {checkingAvailability ? (
                    <span>Consultando disponibilidad...</span>
                  ) : availability ? (
                    availability.available_count > 0 ? (
                      <span>Hay {availability.available_count} disponible{availability.available_count === 1 ? '' : 's'} ahora mismo.</span>
                    ) : availability.busy_count > 0 ? (
                      <span>
                        No hay disponibles: {availability.busy_count} en uso
                        {availability.busy_areas.length > 0 ? ` (${availability.busy_areas.join(', ')})` : ''}.
                      </span>
                    ) : (
                      <span>No hay activos registrados de este tipo en el inventario.</span>
                    )
                  ) : null}
                </div>
              )}
            </label>
            <label>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>¿Qué necesitás y para qué?</div>
              <textarea className="input-field" rows={4} required value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            {error && <p style={{ color: 'var(--danger-color)', fontSize: '0.9rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Send size={16} /> {submitting ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </form>

          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px' }}>Mis solicitudes</h2>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Cargando...</p>
          ) : myRequests.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Todavía no enviaste ninguna solicitud.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myRequests.map((r) => (
                <div key={r.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.category_requested ? CATEGORY_LABELS[r.category_requested] : 'Sin categoría'}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{r.description}</div>
                    </div>
                    <span className={`badge ${r.status === 'assigned' ? 'badge-available' : r.status === 'rejected' ? 'badge-maintenance' : 'badge-loaned'}`}>
                      {REQUEST_STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <RequestCommentThread requestId={r.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="animate-fade-in grid-cards">
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Cargando activos...</p>
          ) : loans.length === 0 && assignments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No tenés activos asignados ni en préstamo.</p>
          ) : (
            <>
              {assignments.map(a => (
                <div key={`assign-${a.id}`} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 600 }}>{a.asset.description}</div>
                    <span className="badge badge-assigned">Asignación Fija</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Código: {a.asset.unique_code} <br/>
                    Vence: {new Date(a.expiration_date).toLocaleDateString()} <br/>
                    {a.notes && <span>Nota: {a.notes}</span>}
                  </div>
                </div>
              ))}
              {loans.filter(l => l.status === 'checked_out' || l.status === 'approved').map(l => (
                <div key={`loan-${l.id}`} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 600 }}>{l.asset.description}</div>
                    <span className="badge badge-loaned">Préstamo Activo</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Código: {l.asset.unique_code} <br/>
                    Aprobado: {l.approval_date ? new Date(l.approval_date).toLocaleDateString() : 'Pendiente'} <br/>
                    Motivo: {l.reason}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="animate-fade-in">
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Cargando historial...</p>
          ) : activityLogs.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No hay actividad registrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activityLogs.map(log => (
                <div key={log.id} className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{log.action}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>{log.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CatalogView = () => {
  const { module } = useModule();
  const currentUser = getCachedUser();
  const canSeeValues = currentUser?.role === 'admin' || currentUser?.role === 'encargado';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [returningAsset, setReturningAsset] = useState<Asset | null>(null);
  const [requestingAsset, setRequestingAsset] = useState<Asset | null>(null);
  const [requestedMsg, setRequestedMsg] = useState<string | null>(null);
  const [inventoryType, setInventoryType] = useState<InventoryType | 'ALL'>('ALL');

  const loadAssets = () => {
    setLoading(true);
    getAssets(module)
      .then(setAssets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAssets();
  }, [module]);

  const handleReturnAssetSubmit = async (details: { observations: string; condition_status: string }) => {
    if (!returningAsset) return;
    try {
      await returnAsset(returningAsset.id, details);
      loadAssets();
      setReturningAsset(null);
    } catch (err: any) {
      alert("Error al devolver: " + err.message);
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = (a.description ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.unique_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.area?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (a.responsible_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesType = inventoryType === 'ALL' || a.inventory_type === inventoryType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Catálogo de Activos</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Cargando...' : `${filteredAssets.length} activos registrados`}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '32px', position: 'relative', maxWidth: '400px' }}>
        <Search size={20} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-secondary)' }} />
        <input
          type="text"
          className="input-field"
          placeholder="Buscar por código, descripción, área o responsable..."
          style={{ paddingLeft: '44px' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
        <button
          className={`btn ${inventoryType === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setInventoryType('ALL')}
        >
          Todos
        </button>
        {Object.entries(INVENTORY_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`btn ${inventoryType === key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setInventoryType(key as InventoryType)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          Cargando activos...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>
          Error al cargar activos: {error}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          No se han creado activos en esta área.
        </div>
      ) : (
        <div className="grid-cards">
          {filteredAssets.map(asset => (
            <div key={asset.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{asset.unique_code}</div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>{asset.description ?? 'Pendiente de registro'}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge badge-${asset.status}`}>
                    {STATUS_LABELS[asset.status]}
                  </span>
                  {(asset.status === 'assigned' || asset.status === 'loaned') && asset.responsible_name && (
                    <span
                      title={`Lo tiene: ${asset.responsible_name}`}
                      style={{ display: 'inline-flex', color: 'var(--text-secondary)', cursor: 'help' }}
                    >
                      <Info size={16} />
                    </span>
                  )}
                  {(asset.status === 'loaned' || asset.status === 'assigned') && (
                    <button
                      className="btn btn-outline"
                      style={{ padding: '6px' }}
                      onClick={() => setReturningAsset(asset)}
                      title="Registrar Devolución"
                    >
                      <CornerDownLeft size={14} />
                    </button>
                  )}
                  <button
                    className="btn btn-outline"
                    style={{ padding: '6px' }}
                    onClick={() => setViewingAsset(asset)}
                    title="Ver detalles"
                  >
                    <Info size={14} />
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '6px' }}
                    onClick={() => setEditingAsset(asset)}
                    title="Editar activo"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Marca/Modelo:</span> {asset.brand_model || '—'}</div>
                {asset.area && <div><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Área:</span> {asset.area}</div>}
                {asset.responsible_name && <div><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Responsable:</span> {asset.responsible_name}</div>}
                {canSeeValues && (asset.purchase_price || asset.estimated_value) != null && (
                  <div>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Valor:</span>{' '}
                    {formatCOP((asset.purchase_price ?? asset.estimated_value) as number)}
                    {asset.value_source === 'estimado' && (
                      <span style={{ opacity: 0.7 }}> (estimado, no oficial)</span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--surface-border)' }}>
                <button
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                  disabled={asset.status !== 'available'}
                  onClick={() => setRequestingAsset(asset)}
                >
                  Solicitar Préstamo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingAsset && (
        <AssetViewModal
          asset={viewingAsset}
          onClose={() => setViewingAsset(null)}
        />
      )}

      {editingAsset && (
        <AssetEditModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSaved={(updated) => setAssets(
            updated.module === module
              ? assets.map(a => (a.id === updated.id ? updated : a))
              : assets.filter(a => a.id !== updated.id)
          )}
        />
      )}

      {returningAsset && (
        <ReturnAssetModal
          asset={returningAsset}
          onClose={() => setReturningAsset(null)}
          onSubmit={handleReturnAssetSubmit}
        />
      )}

      {requestingAsset && (
        <RequestLoanModal
          asset={requestingAsset}
          onClose={() => setRequestingAsset(null)}
          onRequested={() => {
            setRequestedMsg(`Solicitud enviada para ${requestingAsset.unique_code}. Queda pendiente de aprobación.`);
            setTimeout(() => setRequestedMsg(null), 5000);
          }}
        />
      )}

      {requestedMsg && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 300,
          background: 'var(--success-color)', color: 'white', padding: '14px 20px', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {requestedMsg}
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const currentUser = getCachedUser();
  return currentUser?.role === 'empleado' ? <EmployeeRequestView /> : <CatalogView />;
};

export default Dashboard;
