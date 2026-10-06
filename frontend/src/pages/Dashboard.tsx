import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Search, Pencil, Send, Info, CornerDownLeft, Download, Image as ImageIcon, Sparkles, Building2, Car, Package, QrCode, ArrowRight } from 'lucide-react';
import {
  getAssets, formatCOP, STATUS_LABELS, CATEGORY_LABELS,
  createAssetRequest, getMyAssetRequests, getAssetRequests, getAssetAvailability, INVENTORY_TYPE_LABELS,
  getLoans, getAssignments, returnAsset, acceptLoan, acceptAssignment,
  type Asset, type Category, type AssetRequest, type AssetAvailability, type InventoryType,
  type Loan, type Assignment
} from '../api';
import { useModule } from '../moduleContext';
import { useWarehouses } from '../warehouseContext';
import { getCachedUser } from '../components/LoginGate';
import { exportToCsv } from '../utils/exportUtils';
import AssetEditModal from '../components/AssetEditModal';
import AssetViewModal from '../components/AssetViewModal';
import RequestLoanModal from '../components/RequestLoanModal';
import RequestCommentThread from '../components/RequestCommentThread';
import ReturnAssetModal from '../components/ReturnAssetModal';
import Pagination from '../components/Pagination';
import { formatBogotaDate } from '../utils/dateUtils';

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

  const [activeTab, setActiveTab] = useState<'request' | 'assets'>('request');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const currentUser = getCachedUser();

  const load = () => {
    setLoading(true);
    Promise.all([
      getMyAssetRequests().then(setMyRequests),
      getLoans().then(data => setLoans(data.filter(l => l.status !== 'returned' && l.status !== 'rejected'))),
      getAssignments().then(data => setAssignments(data.filter(a => a.status !== 'revoked')))
    ])
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
  };

  const handleAcceptLoan = async (id: number) => {
    try {
      await acceptLoan(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAcceptAssignment = async (id: number) => {
    try {
      await acceptAssignment(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
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
            {currentUser?.warehouses && currentUser.warehouses.length > 0 && currentUser.role === 'empleado' && (
              <span style={{ marginLeft: '12px', fontWeight: 600, color: 'var(--primary)', background: 'var(--surface-color)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                🏢 Empresa: {currentUser.warehouses[0].name}
              </span>
            )}
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
                <div key={r.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.category_requested ? CATEGORY_LABELS[r.category_requested] : 'Sin categoría'}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{r.description}</div>
                    </div>
                    <span className={`badge ${r.status === 'assigned' ? 'badge-available' : r.status === 'rejected' ? 'badge-maintenance' : 'badge-loaned'}`}>
                      {REQUEST_STATUS_LABELS[r.status]}
                    </span>
                  </div>

                  {r.status === 'assigned' && r.resulting_loan && (
                    <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(52, 199, 89, 0.1)', border: '1px solid rgba(52, 199, 89, 0.25)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--success)' }}>Activo Entregado: </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.resulting_loan.asset?.unique_code}</span> — {r.resulting_loan.asset?.description}
                        </div>
                        <span className="badge" style={{
                          background: r.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA' ? 'rgba(255, 149, 0, 0.15)' : 'rgba(52, 199, 89, 0.15)',
                          color: r.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA' ? 'var(--warning)' : 'var(--success)',
                          border: `1px solid ${r.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA' ? 'rgba(255, 149, 0, 0.3)' : 'rgba(52, 199, 89, 0.3)'}`,
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          {r.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA' ? (
                            <><Car size={13} /> Autorizado para Salir</>
                          ) : (
                            <><Building2 size={13} /> Para Uso en la Empresa</>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {r.status === 'rejected' && r.review_notes && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.25)', fontSize: '0.85rem', color: 'var(--danger)' }}>
                      <strong>Motivo de rechazo: </strong>{r.review_notes}
                    </div>
                  )}

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
                <div key={`assign-${a.id}`} className={`glass-panel ${!a.is_accepted ? 'border-l-4 border-yellow-400 bg-yellow-50/10' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 600 }}>{a.asset.description}</div>
                    <span className="badge badge-assigned">Asignación Fija</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Código: {a.asset.unique_code} <br/>
                    Vence: {formatBogotaDate(a.expiration_date)} <br/>
                    {a.notes && <span>Nota: {a.notes}</span>}
                  </div>
                  {!a.is_accepted && (
                    <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ca8a04', marginBottom: '8px' }}>Tienes este equipo pendiente por recoger.</p>
                      <button className="btn btn-primary w-full" onClick={() => handleAcceptAssignment(a.id)}>
                        Recibí este equipo
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {loans.filter(l => l.status === 'checked_out' || l.status === 'approved').map(l => (
                <div key={`loan-${l.id}`} className={`glass-panel ${l.status === 'approved' ? 'border-l-4 border-yellow-400 bg-yellow-50/10' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 600 }}>{l.asset.description}</div>
                    <span className="badge badge-loaned">
                      {l.status === 'approved' ? 'Pendiente de Entrega' : 'Préstamo Activo'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Código: {l.asset.unique_code} <br/>
                    Aprobado: {l.approval_date ? formatBogotaDate(l.approval_date) : 'Pendiente'} <br/>
                    Motivo: {l.reason}
                  </div>
                  {l.status === 'approved' && (
                    <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ca8a04', marginBottom: '8px' }}>Tienes este equipo pendiente por recoger.</p>
                      <button className="btn btn-primary w-full" onClick={() => handleAcceptLoan(l.id)}>
                        Recibí este equipo
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

    </div>
  );
};

const CatalogView = () => {
  const { module } = useModule();
  const { labels } = useWarehouses();
  const currentUser = getCachedUser();
  const canSeeValues = currentUser?.role === 'admin' || currentUser?.role === 'encargado';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogSection, setCatalogSection] = useState<'registered' | 'pending'>('registered');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [returningAsset, setReturningAsset] = useState<Asset | null>(null);
  const [requestingAsset, setRequestingAsset] = useState<Asset | null>(null);
  const [requestedMsg, setRequestedMsg] = useState<string | null>(null);
  const [inventoryType, setInventoryType] = useState<InventoryType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
  }, [module, searchTerm, inventoryType, statusFilter, catalogSection]);

  useEffect(() => {
    if (canSeeValues) {
      getAssetRequests('pending')
        .then(reqs => {
          const scoped = reqs.filter(r => !module || !r.module || r.module === module);
          setPendingRequestsCount(scoped.length);
        })
        .catch(() => {});
    }
  }, [module, canSeeValues]);

  const loadAssets = () => {
    if (!module) return;
    setLoading(true);
    getAssets(module)
      .then(setAssets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (module) {
      loadAssets();
    }
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

  // Separación neta: Activos registrados físicamente vs Stickers/Códigos pendientes por dar de alta
  const registeredAssetsAll = assets.filter(a => a.status !== 'pending_registration');
  const pendingAssetsAll = assets.filter(a => a.status === 'pending_registration');

  // Orden numérico secuencial correlativo (ej: FU-0301, FU-0302...)
  const sortedPendingAssets = [...pendingAssetsAll].sort((a, b) =>
    a.unique_code.localeCompare(b.unique_code, undefined, { numeric: true, sensitivity: 'base' })
  );

  const nextPendingCode = sortedPendingAssets[0]?.unique_code;

  // Filtrado para pestaña de Activos Registrados
  const filteredRegisteredAssets = registeredAssetsAll
    .filter(a => {
      const matchesSearch = (a.description ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.unique_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.area?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (a.responsible_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesType = inventoryType === 'ALL' || a.inventory_type === inventoryType;
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    })
    .sort((a, b) =>
      a.unique_code.localeCompare(b.unique_code, undefined, { numeric: true, sensitivity: 'base' })
    );

  // Filtrado para pestaña de Códigos Pendientes
  const filteredPendingAssets = sortedPendingAssets.filter(a =>
    a.unique_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeItems = catalogSection === 'registered' ? filteredRegisteredAssets : filteredPendingAssets;

  const paginatedItems = activeItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExportCsv = () => {
    const filename = catalogSection === 'registered'
      ? `activos_registrados_${module}_${new Date().toISOString().split('T')[0]}`
      : `codigos_pendientes_${module}_${new Date().toISOString().split('T')[0]}`;

    exportToCsv<Asset>(
      filename,
      [
        { header: 'Código Único', accessor: a => a.unique_code },
        { header: 'Descripción', accessor: a => a.description || '' },
        { header: 'Marca / Modelo', accessor: a => a.brand_model || '' },
        { header: 'Estado', accessor: a => STATUS_LABELS[a.status] || a.status },
        { header: 'Tipo Inventario', accessor: a => INVENTORY_TYPE_LABELS[a.inventory_type] || a.inventory_type },
        { header: 'Área', accessor: a => a.area || '' },
        { header: 'Responsable', accessor: a => a.responsible_name || '' },
        { header: 'Precio Compra (COP)', accessor: a => a.purchase_price || '' },
        { header: 'Valor Estimado (COP)', accessor: a => a.estimated_value || '' },
        { header: 'Categoría', accessor: a => (a.category ? (CATEGORY_LABELS[a.category] || a.category) : '') },
      ],
      activeItems
    );
  };

  const availableCount = registeredAssetsAll.filter(a => a.status === 'available').length;
  const assignedCount = registeredAssetsAll.filter(a => a.status === 'assigned').length;
  const loanedCount = registeredAssetsAll.filter(a => a.status === 'loaned').length;
  const maintenanceCount = registeredAssetsAll.filter(a => a.status === 'maintenance').length;

  return (
    <div className="animate-fade-in">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="title">Catálogo de Activos · {labels[module] || module}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {catalogSection === 'registered'
              ? `${registeredAssetsAll.length} activos dados de alta y listos en inventario`
              : `${pendingAssetsAll.length} stickers generados esperando registro físico`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={handleExportCsv}
          disabled={activeItems.length === 0}
          title="Descargar listado en formato compatible con Excel"
        >
          <Download size={18} />
          Exportar a Excel ({activeItems.length})
        </button>
      </div>

      {/* Alerta visible para administradores y encargados si hay solicitudes pendientes */}
      {pendingRequestsCount > 0 && (
        <div
          className="glass-panel"
          style={{
            marginBottom: '20px',
            padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🔔</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                Hay {pendingRequestsCount} solicitud{pendingRequestsCount === 1 ? '' : 'es'} de activos pendiente{pendingRequestsCount === 1 ? '' : 's'} por gestionar
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Los colaboradores de {labels[module] || module} han solicitado equipos o activos para sus funciones.
              </div>
            </div>
          </div>
          <Link
            to="/requests"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.88rem', textDecoration: 'none' }}
          >
            <span>Gestionar Solicitudes</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {/* PESTAÑAS PRINCIPALES: Separación radical de Activos vs Códigos Pendientes */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button
          className={`btn ${catalogSection === 'registered' ? 'btn-primary' : 'btn-outline'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', padding: '10px 18px' }}
          onClick={() => setCatalogSection('registered')}
        >
          <Package size={18} />
          <span>Activos Registrados</span>
          <span style={{
            background: catalogSection === 'registered' ? 'rgba(0,0,0,0.25)' : 'var(--surface-color)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            {registeredAssetsAll.length}
          </span>
        </button>

        <button
          className={`btn ${catalogSection === 'pending' ? 'btn-primary' : 'btn-outline'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', padding: '10px 18px' }}
          onClick={() => setCatalogSection('pending')}
        >
          <QrCode size={18} />
          <span>Códigos Pendientes de Registro</span>
          <span style={{
            background: catalogSection === 'pending' ? 'rgba(0,0,0,0.25)' : 'rgba(212, 160, 23, 0.2)',
            color: catalogSection === 'pending' ? '#fff' : 'var(--gold)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            {pendingAssetsAll.length}
          </span>
        </button>
      </div>

      {/* BANNER PARA FLUJO SECUENCIAL CUANDO SE ENCUENTRA EN CÓDIGOS PENDIENTES */}
      {catalogSection === 'pending' && (
        <div
          className="glass-panel"
          style={{
            marginBottom: '24px',
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(212, 160, 23, 0.08) 0%, rgba(212, 160, 23, 0.02) 100%)',
            border: '1px solid rgba(212, 160, 23, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>
              <Sparkles size={20} /> Rotulación y Registro en Secuencia Continua
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '600px' }}>
              Los códigos están organizados estrictamente en orden numérico correlativo. Podés registrarlos uno tras otro en esa misma secuencia para rotular los activos físicos.
            </p>
          </div>

          {nextPendingCode && (
            <Link
              to={`/assets/register-by-code?code=${nextPendingCode}`}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '10px 20px', fontWeight: 600 }}
            >
              <span>Registrar Siguiente en Secuencia ({nextPendingCode})</span>
              <ArrowRight size={18} />
            </Link>
          )}
        </div>
      )}

      {/* BUSCADOR */}
      <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '440px' }}>
        <Search size={20} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-secondary)' }} />
        <input
          type="text"
          className="input-field"
          placeholder={catalogSection === 'registered' ? "Buscar por código, descripción, área o responsable..." : "Buscar código específico (ej. FU-0301)..."}
          style={{ paddingLeft: '44px' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* SUBFILTROS: Solo para Activos Registrados */}
      {catalogSection === 'registered' && (
        <>
          {/* Filtros por Estado con Contadores */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { key: 'ALL', label: `Todos (${registeredAssetsAll.length})` },
              { key: 'available', label: `Disponibles (${availableCount})` },
              { key: 'assigned', label: `Asignados (${assignedCount})` },
              { key: 'loaned', label: `En Préstamo (${loanedCount})` },
              { key: 'maintenance', label: `Mantenimiento (${maintenanceCount})` },
            ].map(item => (
              <button
                key={item.key}
                className={`btn ${statusFilter === item.key ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.85rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                onClick={() => setStatusFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Filtros por Tipo de Inventario */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
            <button
              className={`btn ${inventoryType === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={() => setInventoryType('ALL')}
            >
              Todos los Tipos
            </button>
            {Object.entries(INVENTORY_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`btn ${inventoryType === key ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                onClick={() => setInventoryType(key as InventoryType)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          Cargando inventario...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>
          Error al cargar activos: {error}
        </div>
      ) : activeItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          {catalogSection === 'registered'
            ? 'No se encontraron activos registrados con los filtros aplicados.'
            : 'No hay códigos pendientes de registro que coincidan con la búsqueda.'}
        </div>
      ) : catalogSection === 'registered' ? (
        /* VISTA DE ACTIVOS REGISTRADOS */
        <div className="grid-cards">
          {paginatedItems.map(asset => (
            <div key={asset.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  {asset.photo_url ? (
                    <img
                      src={asset.photo_url}
                      alt={asset.description || 'Activo'}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                        border: '1px solid var(--border)',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '8px',
                        background: 'rgba(212, 160, 23, 0.08)',
                        border: '1px dashed var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: 'var(--text-tertiary)'
                      }}
                    >
                      <ImageIcon size={22} />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>{asset.unique_code}</div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asset.description || 'Activo Registrado'}
                    </h3>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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
      ) : (
        /* VISTA DE CÓDIGOS PENDIENTES DE REGISTRO EN SECUENCIA */
        <div className="grid-cards">
          {paginatedItems.map(asset => (
            <div
              key={asset.id}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                borderLeft: '4px solid var(--gold)',
                background: 'rgba(255, 255, 255, 0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: 'rgba(212, 160, 23, 0.12)',
                      border: '1px solid rgba(212, 160, 23, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--gold)'
                    }}
                  >
                    <QrCode size={22} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Sticker Generado
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {asset.unique_code}
                    </h3>
                  </div>
                </div>

                <span className="badge badge-pending_registration" style={{ fontSize: '0.75rem' }}>
                  Por Rotular
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Empresa/Bodega:</span> {labels[asset.module || module] || asset.module || module}</div>
                <div><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Estado:</span> En espera de asignación física</div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--surface-border)' }}>
                <Link
                  to={`/assets/register-by-code?code=${asset.unique_code}`}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.88rem',
                    textDecoration: 'none',
                    fontWeight: 600
                  }}
                >
                  <Sparkles size={16} /> Dar de Alta / Registrar {asset.unique_code}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && activeItems.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={activeItems.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[12, 24, 48, 96]}
        />
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
