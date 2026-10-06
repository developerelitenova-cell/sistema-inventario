import { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  Search, 
  Filter, 
  AlertCircle,
  Package,
  Activity,
  Download
} from 'lucide-react';
import {
  getAssets,
  formatCOP,
  CATEGORY_LABELS,
  STATUS_LABELS,
  type Asset,
  type Category,
  type InventoryType,
  INVENTORY_TYPE_LABELS,
  isMasterAdmin
} from '../api';
import { useModule } from '../moduleContext';
import { useWarehouses } from '../warehouseContext';
import { getCachedUser } from '../components/LoginGate';
import { Navigate } from 'react-router-dom';
import { exportToCsv } from '../utils/exportUtils';

const Accounting = () => {
  const { module } = useModule();
  const { labels } = useWarehouses();
  const currentUser = getCachedUser();
  const isAdmin = isMasterAdmin(currentUser);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [inventoryType, setInventoryType] = useState<InventoryType | 'ALL'>('ALL');

  useEffect(() => {
    setLoading(true);
    getAssets(module)
      .then(setAssets)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [module]);

  // Derivar datos filtrados
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = 
        (asset.description?.toLowerCase().includes(searchQuery.toLowerCase()) || '') ||
        (asset.brand_model?.toLowerCase().includes(searchQuery.toLowerCase()) || '') ||
        (asset.unique_code.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'ALL' || asset.category === selectedCategory;
      const matchesType = inventoryType === 'ALL' || asset.inventory_type === inventoryType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [assets, searchQuery, selectedCategory, inventoryType]);

  // Calcular totales sobre activos filtrados (o sobre totales? Sobre filtrados es más interactivo)
  const stats = useMemo(() => {
    let totalPurchasePrice = 0;
    let totalEstimatedValue = 0;
    let totalLegacyValue = 0; // valor del campo 'value'
    let missingValuesCount = 0;

    filteredAssets.forEach(asset => {
      totalPurchasePrice += asset.purchase_price || 0;
      totalEstimatedValue += asset.estimated_value || 0;
      totalLegacyValue += asset.value || 0;
      
      if (!asset.purchase_price && !asset.estimated_value && !asset.value) {
        missingValuesCount++;
      }
    });

    return {
      count: filteredAssets.length,
      totalPurchasePrice,
      totalEstimatedValue,
      totalLegacyValue,
      missingValuesCount
    };
  }, [filteredAssets]);

  const handleExportCsv = () => {
    exportToCsv<Asset>(
      `reporte_contabilidad_${module}_${new Date().toISOString().split('T')[0]}`,
      [
        { header: 'Código Único', accessor: a => a.unique_code },
        { header: 'Descripción', accessor: a => a.description },
        { header: 'Marca / Modelo', accessor: a => a.brand_model || '' },
        { header: 'Categoría', accessor: a => (a.category ? (CATEGORY_LABELS[a.category] || a.category) : '') },
        { header: 'Tipo Inventario', accessor: a => INVENTORY_TYPE_LABELS[a.inventory_type] || a.inventory_type },
        { header: 'Estado', accessor: a => STATUS_LABELS[a.status] || a.status },
        { header: 'Bodega', accessor: a => labels[a.module] || a.module },
        { header: 'Área', accessor: a => a.area || '' },
        { header: 'Responsable', accessor: a => a.responsible_name || '' },
        { header: 'Precio Compra (COP)', accessor: a => a.purchase_price || 0 },
        { header: 'Valor Estimado (COP)', accessor: a => a.estimated_value || 0 },
        { header: 'Fecha Compra', accessor: a => a.purchase_date || '' },
        { header: 'Origen Valor', accessor: a => a.value_source || '' },
      ],
      filteredAssets
    );
  };

  // Si no es admin, no puede ver esto
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Calculator style={{ color: 'var(--gold)' }} />
            Contabilidad y Auditoría
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Resumen financiero de activos en {labels[module] ?? module}
          </p>
        </div>
        <button
          className="btn btn-primary flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          onClick={handleExportCsv}
          disabled={filteredAssets.length === 0}
          title="Descargar reporte compatible con Excel / Calc"
        >
          <Download size={18} />
          Exportar a Excel ({filteredAssets.length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 border border-red-200">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel flex items-center gap-4 group">
          <div className="p-3 rounded-xl group-hover:scale-110 transition-transform" style={{ backgroundColor: 'var(--gold-light)', color: 'var(--gold-deep)' }}>
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Activos</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.count}</p>
          </div>
        </div>

        <div className="glass-panel flex items-center gap-4 group">
          <div className="p-3 bg-green-100 text-green-700 rounded-xl group-hover:scale-110 transition-transform">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Precio Compra</p>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCOP(stats.totalPurchasePrice)}</p>
          </div>
        </div>

        <div className="glass-panel flex items-center gap-4 group">
          <div className="p-3 rounded-xl group-hover:scale-110 transition-transform" style={{ backgroundColor: 'var(--gold-light)', color: 'var(--gold-deep)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Valor Estimado</p>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCOP(stats.totalEstimatedValue)}</p>
          </div>
        </div>

        <div className="glass-panel flex items-center gap-4 group">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sin Valor</p>
            <p className="text-2xl font-bold text-amber-600">{stats.missingValuesCount}</p>
          </div>
        </div>
      </div>

      {/* Selector de Tipo de Inventario (Tabs) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
            inventoryType === 'ALL' 
              ? 'text-white border-transparent shadow-md' 
              : 'bg-white/50 border-gray-200 hover:bg-white/80'
          }`}
          style={inventoryType === 'ALL' ? { backgroundColor: 'var(--gold)' } : { color: 'var(--text-secondary)' }}
          onClick={() => setInventoryType('ALL')}
        >
          Todos los Tipos
        </button>
        {Object.entries(INVENTORY_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap border ${
              inventoryType === key 
                ? 'text-white border-transparent shadow-md' 
                : 'bg-white/50 border-gray-200 hover:bg-white/80'
            }`}
            style={inventoryType === key ? { backgroundColor: 'var(--gold)' } : { color: 'var(--text-secondary)' }}
            onClick={() => setInventoryType(key as InventoryType)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Controles de Filtrado */}
      <div className="glass-panel flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Buscar por código, descripción o marca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/50 border rounded-xl outline-none transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={20} style={{ color: 'var(--text-tertiary)' }} />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as Category | 'ALL')}
            className="w-full md:w-48 p-2 bg-white/50 border rounded-xl outline-none transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          >
            <option value="ALL">Todas las Categorías</option>
            {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Activos */}
      <div className="glass-panel overflow-hidden" style={{ padding: 0 }}>
        {loading ? (
          <div className="p-8 text-center flex flex-col items-center" style={{ color: 'var(--text-secondary)' }}>
            <Activity className="animate-spin mb-2" size={32} style={{ color: 'var(--gold)' }} />
            <p>Cargando datos contables...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
            No se encontraron activos con estos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderColor: 'var(--border-subtle)' }}>
                  <th className="p-4 font-semibold text-sm" style={{ color: 'var(--ink-secondary)' }}>Código</th>
                  <th className="p-4 font-semibold text-sm" style={{ color: 'var(--ink-secondary)' }}>Descripción / Marca</th>
                  <th className="p-4 font-semibold text-sm" style={{ color: 'var(--ink-secondary)' }}>Categoría</th>
                  <th className="p-4 font-semibold text-sm text-right" style={{ color: 'var(--ink-secondary)' }}>Precio de Compra</th>
                  <th className="p-4 font-semibold text-sm text-right" style={{ color: 'var(--ink-secondary)' }}>Valor Estimado</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map(asset => {
                  const noValue = !asset.purchase_price && !asset.estimated_value && !asset.value;
                  return (
                    <tr 
                      key={asset.id} 
                      className="border-b transition-colors hover:bg-white/40"
                      style={{ 
                        borderColor: 'var(--border-subtle)',
                        backgroundColor: noValue ? 'rgba(255, 193, 7, 0.05)' : 'transparent' 
                      }}
                    >
                      <td className="p-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {asset.unique_code}
                      </td>
                      <td className="p-4">
                        <p className="text-sm line-clamp-1" style={{ color: 'var(--text-primary)' }}>{asset.description || 'Sin descripción'}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{asset.brand_model || 'Sin marca'}</p>
                      </td>
                      <td className="p-4 text-sm">
                        {asset.category ? (
                          <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium" style={{ color: 'var(--ink-secondary)' }}>
                            {CATEGORY_LABELS[asset.category]}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin categorizar</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-right font-medium">
                        {asset.purchase_price ? <span style={{ color: 'var(--text-primary)' }}>{formatCOP(asset.purchase_price)}</span> : <span style={{ color: 'var(--border)' }}>-</span>}
                      </td>
                      <td className="p-4 text-sm text-right font-medium">
                        {asset.estimated_value ? <span style={{ color: 'var(--text-primary)' }}>{formatCOP(asset.estimated_value)}</span> : (
                           asset.value ? <span style={{ color: 'var(--text-primary)' }}>{formatCOP(asset.value)}</span> : <span style={{ color: 'var(--border)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Accounting;
