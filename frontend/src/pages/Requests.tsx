import { useState, useEffect } from 'react';
import { Check, X, BellRing, Info } from 'lucide-react';
import {
  getAssetRequests, assignAssetRequest, rejectAssetRequest, getAssets,
  CATEGORY_LABELS, type AssetRequest, type Asset,
} from '../api';
import { useModule } from '../moduleContext';
import { useWarehouses } from '../warehouseContext';
import UserProfileCard from '../components/UserProfileCard';
import RequestCommentThread from '../components/RequestCommentThread';

const Requests = () => {
  const { module } = useModule();
  const { labels } = useWarehouses();
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [busyAssets, setBusyAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Record<number, string>>({});
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [exitPass, setExitPass] = useState<Record<number, boolean>>({});
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getAssetRequests('pending'), getAssets(module), getAssets()])
      .then(([reqs, assets, allAssets]) => {
        setRequests(reqs.filter(r => r.module === module || r.module === null));
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

  const requestsWithStock = requests.filter(req => assetsFor(req).length > 0);

  const handleAssign = async (req: AssetRequest) => {
    const assetId = selectedAsset[req.id];
    if (!assetId) return;
    setProcessingId(req.id);
    try {
      await assignAssetRequest(req.id, Number(assetId), undefined, exitPass[req.id] || false);
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
      await rejectAssetRequest(req.id);
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
          <h1 className="title">Peticiones Generales</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Revise y asigne activos a las peticiones del personal.
          </p>
        </div>
      </div>

      {!loading && !error && requestsWithStock.length > 0 && (
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
              ? 'Hay 1 solicitud pendiente que ya tiene un activo disponible para asignar.'
              : `Hay ${requestsWithStock.length} solicitudes pendientes que ya tienen activos disponibles para asignar.`}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          No hay solicitudes pendientes en este módulo.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {requests.map((req) => {
            const options = assetsFor(req);
            const hasStock = options.length > 0;
            const inUse = inUseFor(req);
            return (
              <div
                key={req.id}
                className="glass-panel"
                style={{
                  display: 'flex', flexDirection: 'column', gap: '12px',
                  ...(hasStock ? { border: '1px solid rgba(255, 149, 0, 0.4)' } : {}),
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <UserProfileCard
                      user={req.requester}
                      subtitle={req.category_requested ? CATEGORY_LABELS[req.category_requested] : undefined}
                    />
                    {hasStock && (
                      <span className="badge" style={{ background: 'rgba(255, 149, 0, 0.15)', color: 'var(--warning)', border: '1px solid rgba(255, 149, 0, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                        <BellRing size={12} /> Ya hay stock
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '8px' }}>{req.description}</div>
                </div>

                {inUse.length > 0 && (
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

                <RequestCommentThread requestId={req.id} />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '220px' }}>
                    <input
                      type="text"
                      placeholder="Buscar por código o descripción..."
                      className="input-field py-2"
                      value={searchTerms[req.id] || ''}
                      onChange={(e) => setSearchTerms({ ...searchTerms, [req.id]: e.target.value })}
                    />
                    <select
                      className="input-field"
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={exitPass[req.id] || false}
                      onChange={(e) => setExitPass(prev => ({ ...prev, [req.id]: e.target.checked }))}
                    />
                    Requiere boleta de salida
                  </label>
                  <button
                    className="btn btn-primary"
                    disabled={!selectedAsset[req.id] || processingId === req.id}
                    onClick={() => handleAssign(req)}
                  >
                    <Check size={16} /> Asignar
                  </button>
                  <button
                    className="btn bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                    disabled={processingId === req.id}
                    onClick={() => handleReject(req)}
                  >
                    <X size={16} /> Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Requests;
