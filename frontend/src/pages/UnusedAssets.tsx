import { useState, useEffect } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { getUnusedAssets, formatCOP, type UnusedAsset } from '../api';
import { useModule } from '../moduleContext';
import Pagination from '../components/Pagination';

const UnusedAssets = () => {
  const { module } = useModule();
  const [assets, setAssets] = useState<UnusedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setLoading(true);
    getUnusedAssets(module)
      .then(setAssets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [module]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, module]);

  const filteredAssets = assets.filter((a) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.unique_code.toLowerCase().includes(term) ||
      (a.description || '').toLowerCase().includes(term) ||
      (a.brand_model || '').toLowerCase().includes(term) ||
      (a.area || '').toLowerCase().includes(term)
    );
  });

  const paginatedAssets = filteredAssets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Activos sin Uso</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Disponibles hace más de 180 días sin ningún préstamo (o nunca prestados) — candidatos a evaluar para venta.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '420px' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input
          type="text"
          className="input-field"
          style={{ paddingLeft: '40px' }}
          placeholder="Buscar por código, descripción, modelo o área..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : filteredAssets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          {searchTerm ? 'No se encontraron activos que coincidan con la búsqueda.' : 'No hay activos inactivos en este módulo. 🎉'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paginatedAssets.map((asset) => (
            <div key={asset.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--warning-color)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{asset.unique_code}</span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{asset.description}</h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                  {asset.brand_model} {asset.area && `· ${asset.area}`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>
                  {asset.days_since_last_use != null ? `${asset.days_since_last_use} días sin uso` : 'Nunca prestado'}
                </div>
                {(asset.purchase_price ?? asset.estimated_value) != null && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {formatCOP((asset.purchase_price ?? asset.estimated_value) as number)}
                    {!asset.purchase_price && ' (estimado)'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filteredAssets.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredAssets.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      )}
    </div>
  );
};

export default UnusedAssets;
