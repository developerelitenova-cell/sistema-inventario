import { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  Search, 
  AlertCircle,
  Package,
  Activity,
  Printer,
  Building2,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpDown,
  User as UserIcon,
  X,
  FileSpreadsheet,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  getAssets,
  purgeUnregisteredAssets,
  formatCOP,
  CATEGORY_LABELS,
  STATUS_LABELS,
  INVENTORY_TYPE_LABELS,
  type Asset,
  type Category,
  type InventoryType,
  type AssetStatus,
  isMasterAdmin
} from '../api';
import { useModule } from '../moduleContext';
import { useWarehouses } from '../warehouseContext';
import { getCachedUser } from '../components/LoginGate';
import { Navigate } from 'react-router-dom';
import { exportToCsv } from '../utils/exportUtils';
import Pagination from '../components/Pagination';
import AssetViewModal from '../components/AssetViewModal';
import AssetEditModal from '../components/AssetEditModal';
import logoNova from '../assets/logo_elite_nova.png';
import logoFutu from '../assets/logo_futupro.png';

type ValueFilterType = 'ALL' | 'WITH_VALUE' | 'WITHOUT_VALUE';
type SortField = 'unique_code' | 'description' | 'brand_model' | 'module' | 'inventory_type' | 'category' | 'purchase_price' | 'estimated_value' | 'status';

const Accounting = () => {
  const { module: contextModule } = useModule();
  const { warehouses, labels } = useWarehouses();
  const currentUser = getCachedUser();

  // Roles autorizados: Administradores y Encargados
  const isAdmin = currentUser?.role === 'admin';
  const isEncargado = currentUser?.role === 'encargado';
  const isMaster = isMasterAdmin(currentUser);
  const isAuthorized = isAdmin || isEncargado;

  // Selección de bodega: 'ALL' únicamente permitido para Master Admin; de lo contrario primera bodega autorizada
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(() => {
    if (!isMaster) {
      if (contextModule) return contextModule;
      if (warehouses && warehouses.length > 0) return warehouses[0].key;
      return 'futupro';
    }
    return 'ALL';
  });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  // Modo de visualización: Interactivo vs Informe Ejecutivo Gerencial (Listo para Imprimir / PDF)
  const [viewMode, setViewMode] = useState<'interactive' | 'executive_report'>('interactive');

  // Filtros avanzados
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryType, setInventoryType] = useState<InventoryType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<AssetStatus | 'ALL'>('ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [valueFilter, setValueFilter] = useState<ValueFilterType>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Ordenamiento y Paginación
  const [sortBy, setSortBy] = useState<SortField>('unique_code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal para ver foto y detalle completo
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  // Modal para editar / categorizar activo directamente desde el reporte
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // Formateador inteligente de categoría para evitar cruce de información
  const getAssetCategoryLabel = (asset: Asset) => {
    if (asset.category && CATEGORY_LABELS[asset.category]) {
      return CATEGORY_LABELS[asset.category];
    }
    if (asset.inventory_type === 'muebles') return 'Mobiliario y Enseres';
    if (asset.inventory_type === 'publicitario') return 'Material Publicitario';
    return 'Sin categorizar';
  };

  // Inicializar y garantizar bodega seleccionada según rol (solo master admin puede ver ALL)
  useEffect(() => {
    if (!isMaster) {
      if (selectedWarehouse === 'ALL' || (warehouses.length > 0 && !warehouses.some(w => w.key === selectedWarehouse))) {
        const nextWh = (contextModule && warehouses.some(w => w.key === contextModule))
          ? contextModule
          : (warehouses[0]?.key || 'futupro');
        setSelectedWarehouse(nextWh);
      }
    }
  }, [warehouses, contextModule, isMaster, selectedWarehouse]);

  // Carga de activos desde la API
  const loadAssets = () => {
    setLoading(true);
    setError(null);
    const targetModule = selectedWarehouse === 'ALL' ? undefined : selectedWarehouse;
    getAssets(targetModule)
      .then(setAssets)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAssets();
  }, [selectedWarehouse]);

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, inventoryType, selectedCategory, selectedBrand, selectedStatus, selectedArea, valueFilter, dateFrom, dateTo, selectedWarehouse]);

  // Extraer marcas únicas detectadas dinámicamente de los activos
  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    assets.forEach(a => {
      if (a.brand_model && a.brand_model.trim()) {
        const raw = a.brand_model.trim();
        // Obtener la primera palabra o marca limpia (ej. "Apple MacBook" -> "Apple")
        const firstToken = raw.split(/[\s/-]+/)[0].trim();
        if (firstToken && firstToken.length > 1) {
          brandsSet.add(firstToken);
        }
      }
    });
    return Array.from(brandsSet).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  // Extraer áreas únicas presentes en los activos
  const availableAreas = useMemo(() => {
    const areasSet = new Set<string>();
    assets.forEach(a => {
      if (a.area && a.area.trim()) {
        areasSet.add(a.area.trim());
      }
    });
    return Array.from(areasSet).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  // Filtrado de activos
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // Excluir códigos pre-generados que aún no tienen un activo real asignado de la empresa
      if (asset.status === 'pending_registration') {
        return false;
      }
      const descLower = (asset.description || '').trim().toLowerCase();
      const hasRealDesc = Boolean(
        asset.description 
        && descLower 
        && !['sin descripción', 'sin descripcion', 'sin categorizar', 'pendiente de registro', 'pendiente', 'na', 'n/a', 'prueba', 'none'].includes(descLower)
      );
      const hasRealPhoto = Boolean(asset.photo_url || asset.appsheet_photo_ref);
      const hasRealVal = Boolean(asset.purchase_price || asset.estimated_value || asset.value);
      if (!hasRealDesc && !hasRealPhoto && !hasRealVal) {
        return false;
      }

      // Búsqueda por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = asset.unique_code.toLowerCase().includes(q);
        const matchesDesc = (asset.description || '').toLowerCase().includes(q);
        const matchesBrand = (asset.brand_model || '').toLowerCase().includes(q);
        const matchesResp = (asset.responsible_name || '').toLowerCase().includes(q);
        const matchesArea = (asset.area || '').toLowerCase().includes(q);
        const matchesObs = (asset.observations || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesDesc && !matchesBrand && !matchesResp && !matchesArea && !matchesObs) {
          return false;
        }
      }

      // Tipo de inventario (muebles, activos, publicitario)
      if (inventoryType !== 'ALL' && asset.inventory_type !== inventoryType) {
        return false;
      }

      // Categoría
      if (selectedCategory !== 'ALL' && asset.category !== selectedCategory) {
        return false;
      }

      // Marca
      if (selectedBrand !== 'ALL') {
        const brandStr = (asset.brand_model || '').toLowerCase();
        if (!brandStr.includes(selectedBrand.toLowerCase())) {
          return false;
        }
      }

      // Estado operativo
      if (selectedStatus !== 'ALL' && asset.status !== selectedStatus) {
        return false;
      }

      // Área
      if (selectedArea !== 'ALL' && (asset.area || '') !== selectedArea) {
        return false;
      }

      // Filtro de valoración financiera
      if (valueFilter === 'WITH_VALUE') {
        const hasVal = Boolean(asset.purchase_price || asset.estimated_value || asset.value);
        if (!hasVal) return false;
      } else if (valueFilter === 'WITHOUT_VALUE') {
        const hasVal = Boolean(asset.purchase_price || asset.estimated_value || asset.value);
        if (hasVal) return false;
      }

      // Filtro por fecha de compra (Desde / Hasta)
      if (dateFrom) {
        if (!asset.purchase_date) return false;
        const pDate = asset.purchase_date.split('T')[0];
        if (pDate < dateFrom) return false;
      }
      if (dateTo) {
        if (!asset.purchase_date) return false;
        const pDate = asset.purchase_date.split('T')[0];
        if (pDate > dateTo) return false;
      }

      return true;
    });
  }, [assets, searchQuery, inventoryType, selectedCategory, selectedBrand, selectedStatus, selectedArea, valueFilter, dateFrom, dateTo]);

  // Ordenamiento interactivo
  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortBy) {
        case 'unique_code':
          valA = a.unique_code;
          valB = b.unique_code;
          break;
        case 'description':
          valA = (a.description || '').toLowerCase();
          valB = (b.description || '').toLowerCase();
          break;
        case 'brand_model':
          valA = (a.brand_model || '').toLowerCase();
          valB = (b.brand_model || '').toLowerCase();
          break;
        case 'module':
          valA = (labels[a.module] || a.module).toLowerCase();
          valB = (labels[b.module] || b.module).toLowerCase();
          break;
        case 'inventory_type':
          valA = a.inventory_type || '';
          valB = b.inventory_type || '';
          break;
        case 'category':
          valA = a.category ? (CATEGORY_LABELS[a.category] || a.category).toLowerCase() : '';
          valB = b.category ? (CATEGORY_LABELS[b.category] || b.category).toLowerCase() : '';
          break;
        case 'purchase_price':
          valA = a.purchase_price || 0;
          valB = b.purchase_price || 0;
          break;
        case 'estimated_value':
          valA = a.estimated_value || a.value || 0;
          valB = b.estimated_value || b.value || 0;
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredAssets, sortBy, sortDirection, labels]);

  // Paginación
  const paginatedAssets = useMemo(() => {
    if (pageSize === 0) return sortedAssets; // 0 significa 'Todos'
    return sortedAssets.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
  }, [sortedAssets, currentPage, pageSize]);

  // Métricas y Estadísticas Gerenciales Consolidadas
  const stats = useMemo(() => {
    let totalPurchasePrice = 0;
    let totalEstimatedValue = 0;
    let totalPatrimonialValue = 0;
    let missingValuesCount = 0;

    // Desgloses por Bodega
    const warehouseBreakdown: Record<string, { name: string; count: number; purchase: number; estimated: number }> = {};
    // Desgloses por Tipo de Inventario
    const typeBreakdown: Record<InventoryType, { count: number; purchase: number; estimated: number }> = {
      activos: { count: 0, purchase: 0, estimated: 0 },
      muebles: { count: 0, purchase: 0, estimated: 0 },
      publicitario: { count: 0, purchase: 0, estimated: 0 },
    };
    // Desgloses por Estado
    const statusBreakdown: Record<string, number> = {};

    filteredAssets.forEach(asset => {
      const pPrice = asset.purchase_price || 0;
      const eValue = asset.estimated_value || asset.value || 0;
      const bestValue = pPrice > 0 ? pPrice : (eValue > 0 ? eValue : 0);

      totalPurchasePrice += pPrice;
      totalEstimatedValue += eValue;
      totalPatrimonialValue += bestValue;

      if (!asset.purchase_price && !asset.estimated_value && !asset.value) {
        missingValuesCount++;
      }

      // Agrupación por bodega
      const whKey = asset.module || 'desconocida';
      if (!warehouseBreakdown[whKey]) {
        warehouseBreakdown[whKey] = {
          name: labels[whKey] || whKey,
          count: 0,
          purchase: 0,
          estimated: 0,
        };
      }
      warehouseBreakdown[whKey].count++;
      warehouseBreakdown[whKey].purchase += pPrice;
      warehouseBreakdown[whKey].estimated += eValue;

      // Agrupación por tipo de inventario
      const tKey = asset.inventory_type || 'activos';
      if (typeBreakdown[tKey]) {
        typeBreakdown[tKey].count++;
        typeBreakdown[tKey].purchase += pPrice;
        typeBreakdown[tKey].estimated += eValue;
      }

      // Agrupación por estado
      const sKey = asset.status || 'unknown';
      statusBreakdown[sKey] = (statusBreakdown[sKey] || 0) + 1;
    });

    const totalPendingCodes = assets.filter(a => a.status === 'pending_registration').length;

    return {
      count: filteredAssets.length,
      totalAssetsLoaded: assets.length,
      totalPendingCodes,
      totalPurchasePrice,
      totalEstimatedValue,
      totalPatrimonialValue,
      missingValuesCount,
      warehouseBreakdown: Object.values(warehouseBreakdown),
      typeBreakdown,
      statusBreakdown,
    };
  }, [filteredAssets, assets, labels]);

  // Alternar ordenamiento por columna
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  // Resetear filtros
  const handleResetFilters = () => {
    setSearchQuery('');
    setInventoryType('ALL');
    setSelectedCategory('ALL');
    setSelectedBrand('ALL');
    setSelectedStatus('ALL');
    setSelectedArea('ALL');
    setValueFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const activeFiltersCount = [
    searchQuery !== '',
    inventoryType !== 'ALL',
    selectedCategory !== 'ALL',
    selectedBrand !== 'ALL',
    selectedStatus !== 'ALL',
    selectedArea !== 'ALL',
    valueFilter !== 'ALL',
    dateFrom !== '',
    dateTo !== '',
  ].filter(Boolean).length;

  // Exportar a Excel (CSV detallado con UTF-8 BOM)
  const handleExportCsv = () => {
    const warehouseName = selectedWarehouse === 'ALL' ? 'CONSOLIDADO_GENERAL' : (labels[selectedWarehouse] || selectedWarehouse);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Reporte_Activos_${warehouseName.replace(/\s+/g, '_')}_${dateStr}`;

    exportToCsv<Asset>(
      filename,
      [
        { header: 'Código Único', accessor: a => a.unique_code },
        { header: 'Descripción', accessor: a => a.description || '' },
        { header: 'Marca / Modelo', accessor: a => a.brand_model || '' },
        { header: 'Tipo de Inventario', accessor: a => INVENTORY_TYPE_LABELS[a.inventory_type] || a.inventory_type },
        { header: 'Categoría', accessor: a => (a.category ? (CATEGORY_LABELS[a.category] || a.category) : 'Sin categoría') },
        { header: 'Bodega / Sede', accessor: a => labels[a.module] || a.module },
        { header: 'Área', accessor: a => a.area || 'General' },
        { header: 'Responsable Actual', accessor: a => a.responsible_name || 'En custodia de bodega' },
        { header: 'Estado Operativo', accessor: a => STATUS_LABELS[a.status] || a.status },
        { header: 'Precio de Compra (COP)', accessor: a => a.purchase_price ?? '' },
        { header: 'Valor Estimado (COP)', accessor: a => (a.estimated_value || a.value) ?? '' },
        { header: 'Origen del Valor', accessor: a => a.value_source || '' },
        { header: 'Fecha de Compra', accessor: a => a.purchase_date ? a.purchase_date.split('T')[0] : '' },
        { header: 'Accesorios Incluidos', accessor: a => (a.accessories || []).map(acc => acc.name).join(', ') },
        { header: 'Observaciones', accessor: a => a.observations || '' },
      ],
      sortedAssets
    );
  };

  // Disparar diálogo nativo de impresión / Guardar en PDF
  const handlePrint = () => {
    window.print();
  };

  // Purgar datos no registrados realmente (pre-generados sin datos ni valoración)
  const handlePurgeData = async () => {
    const scopeName = selectedWarehouse === 'ALL'
      ? 'todas las bodegas'
      : `la bodega ${labels[selectedWarehouse] || selectedWarehouse}`;

    const msg = `¿Deseas purgar los registros no registrados en ${scopeName}?\n\nEsta acción eliminará únicamente códigos pre-generados vacíos (sin descripción real, sin fotos y sin valoración), conservando el 100% de los activos reales.`;
    if (!window.confirm(msg)) return;

    setPurging(true);
    try {
      const res = await purgeUnregisteredAssets(selectedWarehouse === 'ALL' ? undefined : selectedWarehouse);
      window.alert(res.message);
      loadAssets();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setPurging(false);
    }
  };

  // Redirección si el usuario no tiene permisos
  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in print:p-0">
      {/* =========================================================================
          MODALES DE VISTA Y EDICIÓN RÁPIDA DE ACTIVOS
         ========================================================================= */}
      {viewingAsset && (
        <AssetViewModal 
          asset={viewingAsset} 
          onClose={() => setViewingAsset(null)}
          onEdit={(asset) => {
            setViewingAsset(null);
            setEditingAsset(asset);
          }}
        />
      )}

      {editingAsset && (
        <AssetEditModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSaved={(updated) => {
            setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
            if (viewingAsset && viewingAsset.id === updated.id) {
              setViewingAsset(updated);
            }
          }}
        />
      )}

      {/* =========================================================================
          VISTA 1: INFORME EJECUTIVO GERENCIAL (VISTA FORMAL / IMPRIMIBLE / PDF)
         ========================================================================= */}
      {viewMode === 'executive_report' ? (
        <div className="space-y-6">
          {/* Barra de Controles de Impresión (No sale en el papel) */}
          <div className="print:hidden glass-panel flex flex-wrap items-center justify-between gap-4 p-4 border border-[var(--gold)]/30 bg-gradient-to-r from-amber-50/40 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[var(--gold-light)] text-[var(--gold-deep)]">
                <Printer size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  Modo Informe para Gerencia y Dirección
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Vista formal lista para imprimir o guardar como PDF ejecutivo para el dueño de la compañía.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Selector de Bodega para el Informe Ejecutivo */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-300 shadow-sm">
                <Building2 size={16} className="text-amber-700" />
                <span className="text-xs font-semibold uppercase text-gray-600">Bodega:</span>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="bg-transparent font-medium text-xs outline-none cursor-pointer text-gray-900"
                >
                  {isMaster && (
                    <option value="ALL">🏢 Consolidado General (Todas)</option>
                  )}
                  {warehouses.map(w => (
                    <option key={w.key} value={w.key}>📍 {w.name}</option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-outline flex items-center gap-2 text-xs"
                onClick={() => setViewMode('interactive')}
              >
                <RotateCcw size={15} />
                Volver al Panel Interactivo
              </button>

              <button
                className="btn btn-primary flex items-center gap-2 shadow-md hover:shadow-lg text-xs"
                onClick={handlePrint}
              >
                <Printer size={16} />
                Imprimir / Guardar PDF
              </button>
            </div>
          </div>

          {/* Documento Formal de Informe */}
          <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-200 text-gray-900 print:shadow-none print:border-none print:p-0">
            {/* Membrete Oficial */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b-2 border-amber-600/30 gap-6">
              <div className="flex items-center gap-4">
                <img
                  src={selectedWarehouse === 'futupro' ? logoFutu : logoNova}
                  alt="Logo Empresa"
                  className="h-14 w-auto object-contain"
                />
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 uppercase">
                    {selectedWarehouse === 'futupro' ? 'FUTU PRO' : (selectedWarehouse === 'ALL' ? 'ELITE NUTRITION & FUTU PRO' : (labels[selectedWarehouse] || 'ELITE NUTRITION'))}
                  </h1>
                  <p className="text-xs font-semibold text-amber-700 tracking-wider uppercase">
                    Sistema Central de Gestión de Activos y Control de Inventarios
                  </p>
                </div>
              </div>

              <div className="text-left md:text-right text-xs text-gray-600 space-y-1">
                <p><span className="font-semibold text-gray-800">Fecha de Emisión:</span> {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                <p><span className="font-semibold text-gray-800">Generado Por:</span> {currentUser?.full_name || currentUser?.username} ({currentUser?.role?.toUpperCase()})</p>
                <p><span className="font-semibold text-gray-800">Sede / Bodega:</span> {selectedWarehouse === 'ALL' ? 'CONSOLIDADO GENERAL (TODAS LAS BODEGAS)' : (labels[selectedWarehouse] || selectedWarehouse)}</p>
                {(dateFrom || dateTo) && (
                  <p><span className="font-semibold text-gray-800">Período de Compra:</span> {dateFrom || 'Inicio'} al {dateTo || 'Hoy'}</p>
                )}
              </div>
            </div>

            {/* Título y Objetivo del Informe */}
            <div className="my-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 uppercase tracking-tight">
                INFORME GENERAL DE ACTIVOS E INVENTARIO PATRIMONIAL
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                Documento oficial de control patrimonial presentado a la Gerencia General y Propietario. Contiene el detalle de todos los activos, muebles y material inventariado ingresado al sistema, con su respectiva valoración comercial y ubicación.
              </p>
            </div>

            {/* Resumen Ejecutivo de Cifras */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 mb-6 text-xs">
              <div>
                <p className="text-gray-500 font-medium">Total Activos Listados</p>
                <p className="text-lg font-bold text-gray-900">{stats.count} unidades</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Inversión Total en Compras</p>
                <p className="text-lg font-bold text-gray-900">{formatCOP(stats.totalPurchasePrice)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Valor Comercial Estimado</p>
                <p className="text-lg font-bold text-amber-800">{formatCOP(stats.totalEstimatedValue)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Activos Sin Valorizar</p>
                <p className="text-lg font-bold text-gray-700">{stats.missingValuesCount} unidades</p>
              </div>
            </div>

            {/* Cuadro Resumen por Tipo de Inventario (Muebles vs Equipos vs Publicitario) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-xs">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-100/80 px-4 py-2 font-bold text-gray-800 border-b border-gray-200">
                  Distribución por Tipo de Inventario
                </div>
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 border-b">
                    <tr>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5 text-center">Unidades</th>
                      <th className="p-2.5 text-right">Inversión Compra</th>
                      <th className="p-2.5 text-right">Valor Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(stats.typeBreakdown).map(([tKey, val]) => (
                      <tr key={tKey}>
                        <td className="p-2.5 font-medium text-gray-800">{INVENTORY_TYPE_LABELS[tKey as InventoryType] || tKey}</td>
                        <td className="p-2.5 text-center">{val.count}</td>
                        <td className="p-2.5 text-right">{formatCOP(val.purchase)}</td>
                        <td className="p-2.5 text-right font-medium text-amber-800">{formatCOP(val.estimated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cuadro Resumen por Bodega */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-100/80 px-4 py-2 font-bold text-gray-800 border-b border-gray-200">
                  Distribución por Bodega / Sede
                </div>
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 border-b">
                    <tr>
                      <th className="p-2.5">Bodega</th>
                      <th className="p-2.5 text-center">Unidades</th>
                      <th className="p-2.5 text-right">Inversión Compra</th>
                      <th className="p-2.5 text-right">Valor Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats.warehouseBreakdown.map((wh) => (
                      <tr key={wh.name}>
                        <td className="p-2.5 font-medium text-gray-800">{wh.name}</td>
                        <td className="p-2.5 text-center">{wh.count}</td>
                        <td className="p-2.5 text-right">{formatCOP(wh.purchase)}</td>
                        <td className="p-2.5 text-right font-medium text-amber-800">{formatCOP(wh.estimated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla Detallada de Inventario Formal */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl mb-12">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 border-b border-gray-200 uppercase tracking-wider font-semibold">
                    <th className="p-2.5">Código</th>
                    <th className="p-2.5">Descripción y Modelo</th>
                    <th className="p-2.5">Tipo</th>
                    <th className="p-2.5">Categoría</th>
                    <th className="p-2.5">Bodega / Área</th>
                    <th className="p-2.5">Responsable</th>
                    <th className="p-2.5">Estado</th>
                    <th className="p-2.5 text-right">P. Compra</th>
                    <th className="p-2.5 text-right">V. Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedAssets.map((asset, idx) => (
                    <tr key={asset.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="p-2.5 font-mono font-bold text-gray-900 whitespace-nowrap">
                        {asset.unique_code}
                      </td>
                      <td className="p-2.5">
                        <div className="font-medium text-gray-900">{asset.description || 'Sin descripción'}</div>
                        <div className="text-[11px] text-gray-500 font-medium">Marca: {asset.brand_model || 'No especificada'}</div>
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="font-medium text-gray-700">
                          {INVENTORY_TYPE_LABELS[asset.inventory_type] || asset.inventory_type}
                        </span>
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="font-medium text-gray-700">
                          {getAssetCategoryLabel(asset)}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="font-medium text-gray-800">{labels[asset.module] || asset.module}</div>
                        <div className="text-[11px] text-gray-500">{asset.area || 'General'}</div>
                      </td>
                      <td className="p-2.5 text-gray-700">
                        {asset.responsible_name || 'En custodia de bodega'}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="font-semibold text-gray-800">
                          {STATUS_LABELS[asset.status] || asset.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        {asset.purchase_price ? formatCOP(asset.purchase_price) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-medium text-amber-800 whitespace-nowrap">
                        {asset.estimated_value ? formatCOP(asset.estimated_value) : (asset.value ? formatCOP(asset.value) : '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bloque de Firmas Formales para la Alta Dirección */}
            <div className="grid grid-cols-2 gap-16 pt-12 border-t-2 border-gray-200 text-xs">
              <div className="text-center space-y-12">
                <div className="h-12 flex items-end justify-center">
                  <div className="w-64 border-b border-gray-400"></div>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{currentUser?.full_name || 'Responsable de Inventarios'}</p>
                  <p className="text-gray-500">Elaborado por / Gestión de Inventarios</p>
                </div>
              </div>

              <div className="text-center space-y-12">
                <div className="h-12 flex items-end justify-center">
                  <div className="w-64 border-b border-gray-400"></div>
                </div>
                <div>
                  <p className="font-bold text-gray-900">Gerencia General / Propietario</p>
                  <p className="text-gray-500">Recibido a Conformidad y Verificación Patrimonial</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
            VISTA 2: PANEL INTERACTIVO DE REPORTES Y AUDITORÍA
           ========================================================================= */
        <div className="space-y-6">
          {/* Cabecera Principal y Acciones Ejecutivas */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                <Calculator className="text-[var(--gold)]" size={30} />
                Reportes y Auditoría de Activos
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Consolida, filtra y exporta la información patrimonial y operativa para la dirección de la compañía.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Selector de Bodega */}
              <div className="flex items-center gap-2 bg-white/70 px-3 py-1.5 rounded-xl border border-[var(--border)] shadow-sm">
                <Building2 size={18} className="text-[var(--gold)]" />
                <span className="text-xs font-semibold uppercase text-gray-500">Bodega:</span>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="bg-transparent font-medium text-sm outline-none cursor-pointer pr-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {isMaster && (
                    <option value="ALL">🏢 Todas las Bodegas (Consolidado General)</option>
                  )}
                  {warehouses.map(w => (
                    <option key={w.key} value={w.key}>
                      📍 {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón Purgar Datos No Registrados */}
              {isAdmin && (
                <button
                  className="btn btn-outline flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-all text-xs"
                  onClick={handlePurgeData}
                  disabled={purging}
                  title="Purga códigos pre-generados o vacíos que no tienen datos reales de inventario"
                >
                  <Trash2 size={16} />
                  <span>{purging ? 'Purgando...' : 'Purgar no registrados'}</span>
                </button>
              )}

              {/* Botón Exportar a Excel */}
              <button
                className="btn btn-primary flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                onClick={handleExportCsv}
                disabled={sortedAssets.length === 0}
                title="Descargar reporte completo en formato CSV compatible con Microsoft Excel"
              >
                <FileSpreadsheet size={18} />
                <span>Exportar Excel ({sortedAssets.length})</span>
              </button>

              {/* Botón Vista Informe Gerencial / PDF */}
              <button
                className="btn btn-outline flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
                onClick={() => setViewMode('executive_report')}
                disabled={sortedAssets.length === 0}
                title="Generar formato ejecutivo formal con membrete para el dueño"
              >
                <Printer size={18} />
                <span>Informe Gerencial / PDF</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 border border-red-200">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Tarjetas de Métricas Ejecutivas (KPIs para el dueño) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Activos */}
            <div className="glass-panel flex items-center gap-4 group">
              <div className="p-3.5 rounded-xl group-hover:scale-110 transition-transform bg-[var(--gold-light)] text-[var(--gold-deep)]">
                <Package size={26} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Activos de la Empresa</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.count}</p>
                  <span className="text-xs text-[var(--text-tertiary)]">activos reales</span>
                </div>
                {stats.totalPendingCodes > 0 && (
                  <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                    🏷️ {stats.totalPendingCodes} códigos pendientes de asignar
                  </p>
                )}
              </div>
            </div>

            {/* Inversión en Compras */}
            <div className="glass-panel flex items-center gap-4 group">
              <div className="p-3.5 bg-green-100 text-green-700 rounded-xl group-hover:scale-110 transition-transform">
                <DollarSign size={26} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Inversión en Compras</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{formatCOP(stats.totalPurchasePrice)}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">Costo histórico registrado</p>
              </div>
            </div>

            {/* Valor Comercial Estimado */}
            <div className="glass-panel flex items-center gap-4 group">
              <div className="p-3.5 rounded-xl group-hover:scale-110 transition-transform bg-[var(--gold-light)] text-[var(--gold-deep)]">
                <TrendingUp size={26} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Valor Comercial Estimado</p>
                <p className="text-xl font-bold text-[var(--gold-deep)]">{formatCOP(stats.totalEstimatedValue)}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">Tasación actual del mercado</p>
              </div>
            </div>

            {/* Activos sin Valorizar */}
            <div className="glass-panel flex items-center gap-4 group">
              <div className="p-3.5 bg-amber-100 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                <AlertCircle size={26} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Pendientes por Valorar</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-amber-600">{stats.missingValuesCount}</p>
                  <span className="text-xs text-[var(--text-tertiary)]">activos</span>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)]">Requieren precio o tasación</p>
              </div>
            </div>
          </div>

          {/* Desglose por Bodega y por Tipo de Inventario (Mini Resumen Consolidado) */}
          {selectedWarehouse === 'ALL' && stats.warehouseBreakdown.length > 1 && (
            <div className="glass-panel p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-[var(--gold)]" />
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">
                    Consolidado Patrimonial por Bodega
                  </h3>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  {stats.warehouseBreakdown.length} sedes registradas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.warehouseBreakdown.map(wh => (
                  <div key={wh.name} className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-200/70 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-gray-900">{wh.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        {wh.count} activos
                      </span>
                    </div>
                    <div className="text-xs space-y-1 text-gray-600">
                      <div className="flex justify-between">
                        <span>Compras:</span>
                        <span className="font-medium text-gray-800">{formatCOP(wh.purchase)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor Estimado:</span>
                        <span className="font-semibold text-amber-700">{formatCOP(wh.estimated)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              FILTROS RÁPIDOS Y AVANZADOS
             ========================================================================= */}
          <div className="glass-panel p-5 space-y-4">
            {/* Tabs de Tipo de Inventario */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                <button
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    inventoryType === 'ALL'
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white/60 border-gray-200 hover:bg-white text-gray-600'
                  }`}
                  style={inventoryType === 'ALL' ? { backgroundColor: 'var(--gold)' } : {}}
                  onClick={() => setInventoryType('ALL')}
                >
                  Todos los Tipos ({stats.totalAssetsLoaded})
                </button>

                <button
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    inventoryType === 'muebles'
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white/60 border-gray-200 hover:bg-white text-gray-600'
                  }`}
                  style={inventoryType === 'muebles' ? { backgroundColor: 'var(--gold)' } : {}}
                  onClick={() => setInventoryType('muebles')}
                >
                  <span>🛋️</span>
                  <span>Muebles ({stats.typeBreakdown.muebles.count})</span>
                </button>

                <button
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    inventoryType === 'activos'
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white/60 border-gray-200 hover:bg-white text-gray-600'
                  }`}
                  style={inventoryType === 'activos' ? { backgroundColor: 'var(--gold)' } : {}}
                  onClick={() => setInventoryType('activos')}
                >
                  <span>💻</span>
                  <span>Activos Fijos ({stats.typeBreakdown.activos.count})</span>
                </button>

                <button
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    inventoryType === 'publicitario'
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white/60 border-gray-200 hover:bg-white text-gray-600'
                  }`}
                  style={inventoryType === 'publicitario' ? { backgroundColor: 'var(--gold)' } : {}}
                  onClick={() => setInventoryType('publicitario')}
                >
                  <span>📢</span>
                  <span>Publicitario ({stats.typeBreakdown.publicitario.count})</span>
                </button>
              </div>

              {/* Botón para alternar filtros avanzados */}
              <button
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                  showAdvancedFilters || activeFiltersCount > 0
                    ? 'border-[var(--gold)] text-[var(--gold-deep)] bg-[var(--gold-light)]/30'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <SlidersHorizontal size={14} />
                <span>Filtros Detallados</span>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[var(--gold)] text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>

            {/* Barra de Búsqueda y Filtros Principales */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Buscador de Texto */}
              <div className="relative md:col-span-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por código, descripción, marca, custodio, área o notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/70 border rounded-xl text-sm outline-none transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Filtro por Categoría */}
              <div className="md:col-span-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as Category | 'ALL')}
                  className="w-full p-2.5 bg-white/70 border rounded-xl text-sm outline-none transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="ALL">📦 Todas las Categorías</option>
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Estado */}
              <div className="md:col-span-3">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as AssetStatus | 'ALL')}
                  className="w-full p-2.5 bg-white/70 border rounded-xl text-sm outline-none transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="ALL">🔄 Todos los Estados</option>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtros Avanzados (Desplegables) */}
            {showAdvancedFilters && (
              <div className="pt-3 border-t grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in" style={{ borderColor: 'var(--border-subtle)' }}>
                {/* Filtro por Marca */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Marca / Fabricante</label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full p-2 bg-white/70 border rounded-lg text-xs outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="ALL">Todas las Marcas</option>
                    {availableBrands.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Área */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Área / Ubicación</label>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full p-2 bg-white/70 border rounded-lg text-xs outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="ALL">Todas las Áreas</option>
                    {availableAreas.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Estado de Valoración */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Valoración Financiera</label>
                  <select
                    value={valueFilter}
                    onChange={(e) => setValueFilter(e.target.value as ValueFilterType)}
                    className="w-full p-2 bg-white/70 border rounded-lg text-xs outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="ALL">Todos los Activos</option>
                    <option value="WITH_VALUE">Solo con Valor Registrado</option>
                    <option value="WITHOUT_VALUE">Sin Valor (Pendientes)</option>
                  </select>
                </div>

                {/* Fecha Compra Desde */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Fecha Compra Desde</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full p-1.5 bg-white/70 border rounded-lg text-xs outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Fecha Compra Hasta */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Fecha Compra Hasta</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full p-1.5 bg-white/70 border rounded-lg text-xs outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Botón Reset */}
                <div className="flex items-end">
                  <button
                    onClick={handleResetFilters}
                    disabled={activeFiltersCount === 0}
                    className="w-full p-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-100 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw size={14} />
                    <span>Restablecer Filtros</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              TABLA DETALLADA DE ACTIVOS
             ========================================================================= */}
          <div className="glass-panel overflow-hidden" style={{ padding: 0 }}>
            {loading ? (
              <div className="p-12 text-center flex flex-col items-center" style={{ color: 'var(--text-secondary)' }}>
                <Activity className="animate-spin mb-3 text-[var(--gold)]" size={36} />
                <p className="font-medium text-base">Cargando inventario detallado de activos...</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Sincronizando registros de la bodega</p>
              </div>
            ) : sortedAssets.length === 0 ? (
              <div className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                <Package size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-base">No se encontraron activos con los criterios seleccionados.</p>
                <p className="text-xs mt-1 text-[var(--text-tertiary)]">Intenta cambiando el filtro de bodega, tipo o término de búsqueda.</p>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="btn btn-outline mt-4 text-xs"
                  >
                    Limpiar todos los filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50/70" style={{ borderColor: 'var(--border-subtle)' }}>
                      <th className="p-3.5 font-semibold text-xs text-gray-600 w-12 text-center">Foto</th>
                      <th 
                        className="p-3.5 font-semibold text-xs text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('unique_code')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Código</span>
                          <ArrowUpDown size={12} className={sortBy === 'unique_code' ? 'text-[var(--gold)]' : 'opacity-40'} />
                        </div>
                      </th>
                      <th 
                        className="p-3.5 font-semibold text-xs text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('description')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Descripción y Marca</span>
                          <ArrowUpDown size={12} className={sortBy === 'description' ? 'text-[var(--gold)]' : 'opacity-40'} />
                        </div>
                      </th>
                      <th 
                        className="p-3.5 font-semibold text-xs text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('inventory_type')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Tipo</span>
                          <ArrowUpDown size={12} className={sortBy === 'inventory_type' ? 'text-[var(--gold)]' : 'opacity-40'} />
                        </div>
                      </th>
                      <th 
                        className="p-3.5 font-semibold text-xs text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('category' as SortField)}
                      >
                        <div className="flex items-center gap-1">
                          <span>Categoría</span>
                          <ArrowUpDown size={12} className={sortBy === 'category' ? 'text-[var(--gold)]' : 'opacity-40'} />
                        </div>
                      </th>
                      <th 
                        className="p-3.5 font-semibold text-xs text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('module')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Bodega / Área</span>
                          <ArrowUpDown size={12} className={sortBy === 'module' ? 'text-[var(--gold)]' : 'opacity-40'} />
                        </div>
                      </th>
                      <th className="p-3.5 font-semibold text-xs text-gray-600">Custodio / Responsable</th>
                      <th 
                        className="p-3.5 font-semibold text-xs text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Estado</span>
                          <ArrowUpDown size={12} className={sortBy === 'status' ? 'text-[var(--gold)]' : 'opacity-40'} />
                        </div>
                      </th>
                      <th 
                        className="p-3.5 font-semibold text-xs text-gray-600 text-right cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('purchase_price')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Precio Compra</span>
                          <ArrowUpDown size={12} className={sortBy === 'purchase_price' ? 'text-[var(--gold)]' : 'opacity-40'} />
                        </div>
                      </th>
                      <th 
                        className="p-3.5 font-semibold text-xs text-gray-600 text-right cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort('estimated_value')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Valor Estimado</span>
                          <ArrowUpDown size={12} className={sortBy === 'estimated_value' ? 'text-[var(--gold)]' : 'opacity-40'} />
                        </div>
                      </th>
                      <th className="p-3.5 font-semibold text-xs text-gray-600 text-center w-14">Editar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedAssets.map(asset => {
                      const noValue = !asset.purchase_price && !asset.estimated_value && !asset.value;
                      const photo = asset.photo_url || asset.appsheet_photo_ref;

                      return (
                        <tr 
                          key={asset.id} 
                          className="transition-colors hover:bg-amber-50/20 group cursor-pointer"
                          style={{ 
                            backgroundColor: noValue ? 'rgba(255, 193, 7, 0.04)' : 'transparent' 
                          }}
                          onClick={() => setViewingAsset(asset)}
                          title="Hacer clic para ver detalles y fotos ampliadas"
                        >
                          {/* Miniatura */}
                          <td className="p-2.5 text-center">
                            {photo ? (
                              <img
                                src={photo}
                                alt={asset.description || 'Activo'}
                                className="w-10 h-10 object-cover rounded-lg border border-gray-200 mx-auto shadow-xs group-hover:scale-105 transition-transform"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 mx-auto border border-gray-200">
                                <Package size={18} />
                              </div>
                            )}
                          </td>

                          {/* Código */}
                          <td className="p-3.5 text-xs font-mono font-bold whitespace-nowrap text-gray-900">
                            <span className="px-2 py-1 rounded-md bg-gray-100 border border-gray-200">
                              {asset.unique_code}
                            </span>
                          </td>

                          {/* Descripción y Marca */}
                          <td className="p-3.5 max-w-xs">
                            <p className="text-xs font-semibold text-gray-900 line-clamp-1">
                              {asset.description || 'Sin descripción'}
                            </p>
                            <p className="text-[11px] text-gray-500 line-clamp-1">
                              {asset.brand_model ? `Marca: ${asset.brand_model}` : 'Marca no especificada'}
                            </p>
                            {asset.accessories && asset.accessories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                                  +{asset.accessories.length} accesorios
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Tipo de Inventario */}
                          <td className="p-3.5 text-xs whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              asset.inventory_type === 'muebles'
                                ? 'bg-purple-100 text-purple-800'
                                : asset.inventory_type === 'publicitario'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {asset.inventory_type === 'muebles' ? '🛋️ Muebles' : asset.inventory_type === 'publicitario' ? '📢 Publicitario' : '💻 Activos'}
                            </span>
                          </td>

                          {/* Categoría */}
                          <td className="p-3.5 text-xs whitespace-nowrap">
                            <span className="font-medium text-gray-700">
                              {getAssetCategoryLabel(asset)}
                            </span>
                          </td>

                          {/* Bodega / Área */}
                          <td className="p-3.5 text-xs">
                            <p className="font-semibold text-gray-800 whitespace-nowrap">
                              {labels[asset.module] || asset.module}
                            </p>
                            <p className="text-[11px] text-gray-500 whitespace-nowrap">
                              {asset.area || 'Área General'}
                            </p>
                          </td>

                          {/* Responsable Actual */}
                          <td className="p-3.5 text-xs text-gray-700">
                            {asset.responsible_name ? (
                              <span className="flex items-center gap-1 font-medium">
                                <UserIcon size={12} className="text-gray-400" />
                                {asset.responsible_name}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">En bodega</span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="p-3.5 text-xs whitespace-nowrap">
                            <span className={`badge badge-${asset.status}`}>
                              {STATUS_LABELS[asset.status] || asset.status}
                            </span>
                          </td>

                          {/* Precio de Compra */}
                          <td className="p-3.5 text-xs text-right font-medium whitespace-nowrap">
                            {asset.purchase_price ? (
                              <span className="font-semibold text-gray-900">{formatCOP(asset.purchase_price)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Valor Estimado */}
                          <td className="p-3.5 text-xs text-right font-semibold whitespace-nowrap">
                            {asset.estimated_value ? (
                              <span className="text-amber-700">{formatCOP(asset.estimated_value)}</span>
                            ) : asset.value ? (
                              <span className="text-amber-700">{formatCOP(asset.value)}</span>
                            ) : (
                              <span className="text-amber-500 font-normal italic text-[11px]">Por valorar</span>
                            )}
                          </td>

                          {/* Botón de Edición Rápida */}
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAsset(asset);
                              }}
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-amber-800 hover:border-amber-400 hover:bg-amber-50/60 transition-all shadow-2xs"
                              title="Editar / Categorizar este activo"
                            >
                              <Pencil size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paginación */}
          {!loading && !error && sortedAssets.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
              <div>
                Mostrando activos {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, sortedAssets.length)} de un total de {sortedAssets.length}
              </div>

              <Pagination
                currentPage={currentPage}
                totalItems={sortedAssets.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[15, 25, 50, 100]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Accounting;
