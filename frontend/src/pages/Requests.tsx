import { useState, useEffect } from 'react';
import {
  Check, X, BellRing, Info, Search, Building2, Car, Clock,
  CheckCircle2, XCircle, FileText
} from 'lucide-react';
import {
  getAssetRequests, assignAssetRequest, rejectAssetRequest, getAssets,
  CATEGORY_LABELS, type AssetRequest, type Asset,
} from '../api';
import { useModule } from '../moduleContext';
import { useWarehouses } from '../warehouseContext';
import UserProfileCard from '../components/UserProfileCard';
import RequestCommentThread from '../components/RequestCommentThread';

type TabType = 'pending' | 'assigned' | 'rejected' | 'all';

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignada',
  rejected: 'Rechazada',
};

const Requests = () => {
  const { module } = useModule();
  const { labels } = useWarehouses();
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [busyAssets, setBusyAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedAsset, setSelectedAsset] = useState<Record<number, string>>({});
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [exitPass, setExitPass] = useState<Record<number, boolean>>({});
  const [assignNotes, setAssignNotes] = useState<Record<number, string>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<number, string>>({});
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getAssetRequests(), getAssets(module), getAssets()])
      .then(([reqs, assets, allAssets]) => {
        setRequests(reqs);
        setAvailableAssets(assets.filter(a => a.status === 'available'));
        setBusyAssets(allAssets.filter(a => a.status === 'assigned' || a.status === 'loaned'));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [module]);

  const assetsFor = (req: AssetRequest) =>
    req.category_requested
      ? availableAssets.filter(a => a.category === req.category_requested)
      : availableAssets;

  const inUseFor = (req: AssetRequest) =>
    req.category_requested
      ? busyAssets.filter(a => a.category === req.category_requested)
      : [];

  const handleAssign = async (req: AssetRequest) => {
    const assetId = selectedAsset[req.id];
    if (!assetId) return;
    setProcessingId(req.id);
    try {
      await assignAssetRequest(
        req.id,
        Number(assetId),
        assignNotes[req.id] || undefined,
        exitPass[req.id] || false
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: AssetRequest) => {
    setProcessingId(req.id);
    try {
      await rejectAssetRequest(req.id, rejectNotes[req.id] || undefined);
      setRejectingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  // Filter requests by current active module if selected
  const moduleFilteredRequests = requests.filter(req => !module || !req.module || req.module === module);

  const pendingCount = moduleFilteredRequests.filter(r => r.status === 'pending').length;
  const assignedCount = moduleFilteredRequests.filter(r => r.status === 'assigned').length;
  const rejectedCount = moduleFilteredRequests.filter(r => r.status === 'rejected').length;
  const allCount = moduleFilteredRequests.length;

  const requestsWithStock = moduleFilteredRequests
    .filter(req => req.status === 'pending')
    .filter(req => assetsFor(req).length > 0);

  const tabFiltered = moduleFilteredRequests.filter(r => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const filteredRequests = tabFiltered.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const requesterName = (r.requester?.full_name || '').toLowerCase();
    const requesterDoc = (r.requester?.document_id || '').toLowerCase();
    const requesterCargo = (r.requester?.cargo || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    const cat = r.category_requested ? (CATEGORY_LABELS[r.category_requested] || '').toLowerCase() : '';
    const assetCode = (r.resulting_loan?.asset?.unique_code || '').toLowerCase();
    const assetDesc = (r.resulting_loan?.asset?.description || '').toLowerCase();
    return (
      requesterName.includes(q) ||
      requesterDoc.includes(q) ||
      requesterCargo.includes(q) ||
      desc.includes(q) ||
      cat.includes(q) ||
      assetCode.includes(q) ||
      assetDesc.includes(q)
    );
  });

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Historial y Solicitudes de Activos</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Gestione las solicitudes del personal, categorice la asignación para su uso en la empresa o con pase de salida, y consulte el historial completo.
          </p>
        </div>
      </div>

      {/* Tabs bar and search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('pending')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', position: 'relative' }}
            >
              <Clock size={16} />
              Pendientes
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: activeTab === 'pending' ? 'rgba(255,255,255,0.25)' : 'rgba(255, 149, 0, 0.2)',
                  color: activeTab === 'pending' ? '#fff' : 'var(--warning)',
                  fontWeight: 700,
                }}
              >
                {pendingCount}
              </span>
            </button>

            <button
              className={`btn ${activeTab === 'assigned' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('assigned')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCircle2 size={16} />
              Asignadas (En Uso en Empresa)
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: activeTab === 'assigned' ? 'rgba(255,255,255,0.25)' : 'rgba(52, 199, 89, 0.2)',
                  color: activeTab === 'assigned' ? '#fff' : 'var(--success)',
                  fontWeight: 700,
                }}
              >
                {assignedCount}
              </span>
            </button>

            <button
              className={`btn ${activeTab === 'rejected' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('rejected')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <XCircle size={16} />
              Rechazadas
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: activeTab === 'rejected' ? 'rgba(255,255,255,0.25)' : 'rgba(255, 59, 48, 0.2)',
                  color: activeTab === 'rejected' ? '#fff' : 'var(--danger)',
                  fontWeight: 700,
                }}
              >
                {rejectedCount}
              </span>
            </button>

            <button
              className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('all')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <FileText size={16} />
              Historial Completo
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: activeTab === 'all' ? 'rgba(255,255,255,0.25)' : 'rgba(148, 163, 184, 0.2)',
                  color: activeTab === 'all' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700,
                }}
              >
                {allCount}
              </span>
            </button>
          </div>

          <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 280px', maxWidth: '450px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '38px', paddingRight: searchQuery ? '36px' : '14px', width: '100%' }}
              placeholder="Buscar por solicitante, cédula, activo o detalle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stock alert if on pending tab */}
      {!loading && !error && activeTab === 'pending' && requestsWithStock.length > 0 && (
        <div
          className="glass-panel"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px',
            background: 'rgba(255, 149, 0, 0.12)', border: '1px solid rgba(255, 149, 0, 0.3)', color: 'var(--warning)',
          }}
        >
          <BellRing size={18} />
          <span>
            {requestsWithStock.length === 1
              ? 'Hay 1 solicitud pendiente que ya cuenta con un activo disponible para asignar.'
              : `Hay ${requestsWithStock.length} solicitudes pendientes que ya cuentan con activos disponibles para asignar.`}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Cargando solicitudes...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : filteredRequests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }} className="glass-panel">
          {searchQuery ? (
            <span>No se encontraron solicitudes que coincidan con &quot;{searchQuery}&quot;.</span>
          ) : activeTab === 'pending' ? (
            <span>No hay solicitudes pendientes en este módulo.</span>
          ) : activeTab === 'assigned' ? (
            <span>No hay solicitudes asignadas en este módulo todavía.</span>
          ) : activeTab === 'rejected' ? (
            <span>No hay solicitudes rechazadas.</span>
          ) : (
            <span>No hay historial de solicitudes registrado.</span>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredRequests.map((req) => {
            const options = assetsFor(req);
            const hasStock = options.length > 0;
            const inUse = inUseFor(req);
            const isPending = req.status === 'pending';
            const isAssigned = req.status === 'assigned';
            const isRejected = req.status === 'rejected';

            return (
              <div
                key={req.id}
                className="glass-panel"
                style={{
                  display: 'flex', flexDirection: 'column', gap: '14px',
                  ...(isPending && hasStock ? { border: '1px solid rgba(255, 149, 0, 0.4)' } : {}),
                  ...(isAssigned ? { borderLeft: '4px solid var(--success)' } : {}),
                  ...(isRejected ? { borderLeft: '4px solid var(--danger)' } : {}),
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                    <UserProfileCard
                      user={req.requester}
                      subtitle={req.category_requested ? CATEGORY_LABELS[req.category_requested] : 'General'}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        className={`badge ${
                          isAssigned ? 'badge-available' : isRejected ? 'badge-maintenance' : 'badge-loaned'
                        }`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        {isAssigned && <CheckCircle2 size={13} />}
                        {isRejected && <XCircle size={13} />}
                        {isPending && <Clock size={13} />}
                        {REQUEST_STATUS_LABELS[req.status] || req.status}
                      </span>
                      {isPending && hasStock && (
                        <span className="badge" style={{ background: 'rgba(255, 149, 0, 0.15)', color: 'var(--warning)', border: '1px solid rgba(255, 149, 0, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                          <BellRing size={12} /> Hay stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Fecha solicitud: {new Date(req.created_at).toLocaleString()}</span>
                    {req.module && (
                      <span>• Bodega: {labels[req.module] || req.module}</span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '10px', background: 'rgba(0,0,0,0.08)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>
                      Necesidad expresada por el colaborador:
                    </div>
                    {req.description}
                  </div>
                </div>

                {/* Info if assets in other areas exist */}
                {isPending && inUse.length > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <Info size={14} /> Ya hay {inUse.length === 1 ? 'un activo de este tipo' : `${inUse.length} activos de este tipo`} en uso por otras áreas:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                      {inUse.map(a => (
                        <li key={a.id}>
                          {a.unique_code}{a.module !== req.module ? ` (${labels[a.module] ?? a.module})` : ''} — {a.area ?? 'área sin registrar'}
                          {a.responsible_name ? `, responsable: ${a.responsible_name}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* DETAILS IF ASSIGNED */}
                {isAssigned && req.resulting_loan && (
                  <div
                    style={{
                      background: 'rgba(52, 199, 89, 0.08)',
                      border: '1px solid rgba(52, 199, 89, 0.25)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--success)' }}>
                          Activo Asignado:
                        </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, background: 'rgba(52, 199, 89, 0.2)', color: 'var(--success)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(52, 199, 89, 0.3)' }}>
                          {req.resulting_loan.asset?.unique_code || '—'}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {req.resulting_loan.asset?.description || 'Sin descripción'}
                        </span>
                      </div>

                      {/* Categorization Badge */}
                      <span
                        className="badge"
                        style={{
                          background: req.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA'
                            ? 'rgba(255, 149, 0, 0.15)'
                            : 'rgba(52, 199, 89, 0.15)',
                          color: req.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA'
                            ? 'var(--warning)'
                            : 'var(--success)',
                          border: `1px solid ${
                            req.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA'
                              ? 'rgba(255, 149, 0, 0.3)'
                              : 'rgba(52, 199, 89, 0.3)'
                          }`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {req.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA' ? (
                          <>
                            <Car size={14} /> Autorizado para Salir de la Empresa
                          </>
                        ) : (
                          <>
                            <Building2 size={14} /> Activo Asignado para Uso en la Empresa
                          </>
                        )}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {req.resulting_loan.asset?.brand_model && (
                        <div>
                          <strong>Marca / Modelo:</strong> {req.resulting_loan.asset.brand_model}
                        </div>
                      )}
                      {req.resulting_loan.asset?.module && (
                        <div>
                          <strong>Bodega / Sede:</strong> {labels[req.resulting_loan.asset.module] || req.resulting_loan.asset.module}
                        </div>
                      )}
                      <div>
                        <strong>Asignado por:</strong> {req.reviewed_by?.full_name || 'Administrador'}
                      </div>
                      <div>
                        <strong>Fecha de entrega:</strong> {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : '—'}
                      </div>
                    </div>

                    {req.review_notes && (
                      <div style={{ background: 'rgba(0,0,0,0.12)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Observaciones de asignación: </span>
                        {req.review_notes}
                      </div>
                    )}

                    {req.resulting_loan.security_authorization === 'AUTORIZADO_SALIDA' && req.resulting_loan.id && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <a
                          href={`/security-exit/${req.resulting_loan.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.85rem', color: 'var(--warning)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FileText size={14} /> Ver Boleta / Pase de Salida Oficial
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* DETAILS IF REJECTED */}
                {isRejected && (
                  <div
                    style={{
                      background: 'rgba(255, 59, 48, 0.08)',
                      border: '1px solid rgba(255, 59, 48, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <XCircle size={15} /> Solicitud Rechazada
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Revisada por: <strong style={{ color: 'var(--text-primary)' }}>{req.reviewed_by?.full_name || 'Administrador'}</strong>
                    </div>
                    {req.review_notes && (
                      <div style={{ background: 'rgba(255, 59, 48, 0.12)', padding: '8px 10px', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '4px' }}>
                        <strong>Motivo: </strong>{req.review_notes}
                      </div>
                    )}
                  </div>
                )}

                <RequestCommentThread requestId={req.id} />

                {/* ASSIGNMENT CONTROLS FOR PENDING REQUESTS */}
                {isPending && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      Gestionar Asignación de Activo
                    </div>

                    {/* Step 1: Search and select asset */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                      <input
                        type="text"
                        placeholder="Buscar por código o descripción disponible..."
                        className="input-field"
                        style={{ padding: '10px 14px' }}
                        value={searchTerms[req.id] || ''}
                        onChange={(e) => setSearchTerms({ ...searchTerms, [req.id]: e.target.value })}
                      />
                      <select
                        className="input-field"
                        style={{ padding: '10px 14px' }}
                        value={selectedAsset[req.id] ?? ''}
                        onChange={(e) => setSelectedAsset({ ...selectedAsset, [req.id]: e.target.value })}
                      >
                        <option value="">
                          {options.length === 0 ? 'No hay activos disponibles de esa categoría' : 'Elegir activo disponible...'}
                        </option>
                        {options
                          .filter(a => {
                            const term = (searchTerms[req.id] || '').toLowerCase();
                            return a.unique_code.toLowerCase().includes(term) || (a.description || '').toLowerCase().includes(term);
                          })
                          .map(a => (
                          <option key={a.id} value={a.id}>{a.unique_code} — {a.description}</option>
                        ))}
                      </select>
                    </div>

                    {/* Step 2: Categorization of destination within company vs exit */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Categorización del destino y uso del activo:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                        <div
                          onClick={() => setExitPass(prev => ({ ...prev, [req.id]: false }))}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.2s',
                            border: !exitPass[req.id]
                              ? '2px solid var(--success)'
                              : '1px solid var(--border)',
                            background: !exitPass[req.id]
                              ? 'rgba(52, 199, 89, 0.12)'
                              : 'rgba(255, 255, 255, 0.02)',
                          }}
                        >
                          <Building2 size={20} style={{ color: !exitPass[req.id] ? 'var(--success)' : 'var(--text-secondary)' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: !exitPass[req.id] ? 'var(--success)' : 'var(--text-primary)' }}>
                              🏢 Uso Interno en la Empresa
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              El activo permanece dentro de las instalaciones o sedes.
                            </div>
                          </div>
                        </div>

                        <div
                          onClick={() => setExitPass(prev => ({ ...prev, [req.id]: true }))}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.2s',
                            border: exitPass[req.id]
                              ? '2px solid var(--warning)'
                              : '1px solid var(--border)',
                            background: exitPass[req.id]
                              ? 'rgba(255, 149, 0, 0.12)'
                              : 'rgba(255, 255, 255, 0.02)',
                          }}
                        >
                          <Car size={20} style={{ color: exitPass[req.id] ? 'var(--warning)' : 'var(--text-secondary)' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: exitPass[req.id] ? 'var(--warning)' : 'var(--text-primary)' }}>
                              🚗 Autorizado para Salir
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Genera pase y boleta de salida autorizada.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Optional notes for assignment */}
                    <div>
                      <input
                        type="text"
                        placeholder="Observaciones o notas de entrega para el colaborador (opcional)..."
                        className="input-field"
                        style={{ padding: '10px 14px' }}
                        value={assignNotes[req.id] || ''}
                        onChange={(e) => setAssignNotes({ ...assignNotes, [req.id]: e.target.value })}
                      />
                    </div>

                    {/* Step 4: Rejection section if expanding rejection */}
                    {rejectingId === req.id && (
                      <div style={{ background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.3)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)' }}>
                          Indique el motivo del rechazo:
                        </label>
                        <input
                          type="text"
                          placeholder="Motivo (ej: Sin stock disponible en bodega, solicitud no aprobada por jefatura)..."
                          className="input-field"
                          style={{ padding: '8px 12px' }}
                          value={rejectNotes[req.id] || ''}
                          onChange={(e) => setRejectNotes({ ...rejectNotes, [req.id]: e.target.value })}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-outline"
                            onClick={() => setRejectingId(null)}
                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                          >
                            Cancelar
                          </button>
                          <button
                            className="btn"
                            style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }}
                            disabled={processingId === req.id}
                            onClick={() => handleReject(req)}
                          >
                            Confirmar Rechazo
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {rejectingId !== req.id && (
                        <button
                          className="btn"
                          style={{ background: 'rgba(255, 59, 48, 0.15)', color: 'var(--danger)', border: '1px solid rgba(255, 59, 48, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          disabled={processingId === req.id}
                          onClick={() => setRejectingId(req.id)}
                        >
                          <X size={16} /> Rechazar Solicitud
                        </button>
                      )}
                      <button
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        disabled={!selectedAsset[req.id] || processingId === req.id}
                        onClick={() => handleAssign(req)}
                      >
                        <Check size={16} />
                        {processingId === req.id ? 'Asignando...' : 'Asignar Activo'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Requests;
