import { useState, useEffect } from "react";
import { Search, Printer, Sparkles, Building2, CheckCircle2, Clock, Layers } from "lucide-react";
import { getAssets, batchGenerateAssets, type Asset, type Module } from "../api";
import { useModule } from "../moduleContext";
import { useWarehouses } from "../warehouseContext";

const suggestPrefix = (key: string): string => key.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "AA";

const getLogoUrl = (moduleKey: string): string => {
  const key = moduleKey.toLowerCase();
  if (key.includes("futu")) return "/logo_futupro.png";
  return "/logo_elite_nutrition.jpeg";
};

const getAccentColor = (moduleKey: string): string => {
  const key = moduleKey.toLowerCase();
  if (key.includes("futu")) return "#b8960c";
  return "#1e3a6e";
};

const QRCodes = () => {
  const { module, setModule } = useModule();
  const { warehouses, labels } = useWarehouses();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "registered">("all");
  const [batchModule, setBatchModule] = useState<Module>(module);
  const [prefix, setPrefix] = useState(suggestPrefix(module));
  const [quantity, setQuantity] = useState(100);
  const [generating, setGenerating] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSuccess, setBatchSuccess] = useState<string | null>(null);

  const [allowedWarehouses, setAllowedWarehouses] = useState(warehouses);

  useEffect(() => {
    import('../components/LoginGate').then(m => {
      const user = m.getCachedUser();
      const isEncargado = user?.role?.toLowerCase() === 'encargado';
      let visible = warehouses.filter((w) => w.is_active);
      if (isEncargado && user?.warehouses) {
        const allowedKeys = user.warehouses.map(w => w.key);
        visible = visible.filter(w => allowedKeys.includes(w.key));
      }
      setAllowedWarehouses(visible);
    });
  }, [warehouses]);

  useEffect(() => {
    if (!module) return;
    setLoading(true);
    setBatchModule(module);
    setPrefix(suggestPrefix(module));
    setBatchSuccess(null);
    getAssets(module)
      .then(setAssets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [module]);

  const handleGenerateBatch = async () => {
    if (!batchModule) {
      setBatchError("Debe seleccionar un módulo para generar los códigos QR.");
      return;
    }
    setGenerating(true);
    setBatchError(null);
    setBatchSuccess(null);
    try {
      const newAssets = await batchGenerateAssets({ module: batchModule, prefix, quantity });
      if (batchModule === module) {
        setAssets((prev) => [...prev, ...newAssets]);
      }
      const firstCode = newAssets[0]?.unique_code || "";
      const lastCode = newAssets[newAssets.length - 1]?.unique_code || "";
      setBatchSuccess(`¡Lote de ${newAssets.length} stickers generado exitosamente en secuencia correlativa! Rango: ${firstCode} al ${lastCode}`);
      setFilterMode("pending");
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  // Orden natural secuencial por código correlativo (ej. EE-0001, EE-0002...)
  const sortedAssets = [...assets].sort((a, b) =>
    a.unique_code.localeCompare(b.unique_code, undefined, { numeric: true, sensitivity: "base" })
  );

  const pendingCount = sortedAssets.filter((a) => a.status === "pending_registration").length;
  const registeredCount = sortedAssets.filter((a) => a.status !== "pending_registration").length;

  const filtered = sortedAssets
    .filter((a) => {
      if (filterMode === "pending") return a.status === "pending_registration";
      if (filterMode === "registered") return a.status !== "pending_registration";
      return true;
    })
    .filter(
      (a) =>
        (a.description ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.unique_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.brand_model ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="animate-fade-in">
      <div className="header no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h1 className="title" style={{ margin: 0 }}>Códigos QR y Stickers</h1>
            <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.85rem" }}>
              <Building2 size={13} /> {labels[module] || module}
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>
            {loading ? "Cargando códigos..." : `${filtered.length} stickers listos para rotulación física e impresión (Secuencia correlativa)`}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {allowedWarehouses.length > 1 && (
            <select
              className="input-field"
              style={{ padding: "8px 12px", fontSize: "0.9rem", minWidth: "160px" }}
              value={module}
              onChange={(e) => setModule(e.target.value)}
            >
              {allowedWarehouses.map((w) => (
                <option key={w.key} value={w.key}>Bodega: {w.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-primary" onClick={() => window.print()} disabled={filtered.length === 0}>
            <Printer size={18} /> Imprimir Selección ({filtered.length})
          </button>
        </div>
      </div>

      {/* Panel Generador de Lotes */}
      <div className="no-print glass-panel" style={{ marginBottom: "24px", padding: "20px", maxWidth: "720px" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
          <Sparkles size={18} style={{ color: "var(--gold)" }} /> Generar Lote de Códigos en Secuencia
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "-6px", marginBottom: "16px" }}>
          Crea stickers correlativos con prefijo oficial para rotulación de activos nuevos en bodega.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 180px" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Bodega Destino</div>
            <select
              className="input-field"
              value={batchModule}
              onChange={(e) => {
                const m = e.target.value as Module;
                setBatchModule(m);
                setPrefix(suggestPrefix(m));
              }}
            >
              <option value="">Seleccione una bodega</option>
              {allowedWarehouses.map((w) => (
                <option key={w.key} value={w.key}>{w.name}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: "1 1 110px" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Prefijo</div>
            <input className="input-field" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="Ej. EE o FP" />
          </label>
          <label style={{ flex: "1 1 110px" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Cantidad (1-500)</div>
            <input className="input-field" type="number" min={1} max={500} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </label>
          <button className="btn btn-primary" onClick={handleGenerateBatch} disabled={generating || !prefix || !batchModule}>
            {generating ? "Generando..." : "Generar Stickers"}
          </button>
        </div>

        {batchError && <p style={{ color: "var(--danger-color)", fontSize: "0.9rem", marginTop: "12px", background: "#fef2f2", padding: "8px 12px", borderRadius: "8px" }}>{batchError}</p>}
        {batchSuccess && <p style={{ color: "#15803d", fontSize: "0.9rem", marginTop: "12px", background: "#f0fdf4", padding: "8px 12px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>{batchSuccess}</p>}
      </div>

      {/* Barra de Filtros y Diferenciación Clara */}
      <div className="no-print" style={{ marginBottom: "20px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        
        {/* Pestañas de Diferenciación */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
          <button
            className={`btn ${filterMode === "all" ? "btn-primary" : "btn-outline"}`}
            style={{ fontSize: "0.85rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
            onClick={() => setFilterMode("all")}
          >
            <Layers size={15} /> Todos ({sortedAssets.length})
          </button>
          <button
            className={`btn ${filterMode === "pending" ? "btn-primary" : "btn-outline"}`}
            style={{ fontSize: "0.85rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
            onClick={() => setFilterMode("pending")}
            title="Códigos QR generados por lote esperando rotulación de activo"
          >
            <Clock size={15} /> ⏳ En Espera de Registro ({pendingCount})
          </button>
          <button
            className={`btn ${filterMode === "registered" ? "btn-primary" : "btn-outline"}`}
            style={{ fontSize: "0.85rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
            onClick={() => setFilterMode("registered")}
            title="Activos formalmente registrados con ficha técnica y foto"
          >
            <CheckCircle2 size={15} /> ✅ Activos Dados de Alta ({registeredCount})
          </button>
        </div>

        {/* Buscador */}
        <div style={{ position: "relative", minWidth: "260px", maxWidth: "360px", flex: "1 1 240px" }}>
          <Search size={18} style={{ position: "absolute", left: "14px", top: "11px", color: "var(--text-secondary)" }} />
          <input
            type="text"
            className="input-field"
            placeholder="Buscar código o descripción..."
            style={{ paddingLeft: "40px", fontSize: "0.9rem" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="no-print" style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>Cargando códigos de {labels[module] || module}...</div>
      ) : error ? (
        <div className="no-print" style={{ textAlign: "center", padding: "60px", color: "var(--danger-color)" }}>Error: {error}</div>
      ) : filtered.length === 0 ? (
        <div className="no-print" style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
          No se encontraron stickers con el filtro seleccionado en esta bodega.
        </div>
      ) : (
        <div className="qr-sticker-grid">
          {filtered.map((asset) => {
            const isPending = asset.status === "pending_registration";
            return (
              <div key={asset.id} className={`qr-sticker-wrapper ${isPending ? 'is-pending-wrapper' : 'is-registered-wrapper'}`}>
                {/* Diferenciador visual en pantalla (se oculta al imprimir) */}
                <div className="no-print sticker-status-pill">
                  {isPending ? (
                    <span style={{ color: "#d97706", fontWeight: 600 }}>⏳ Espera de Registro</span>
                  ) : (
                    <span style={{ color: "#15803d", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                      ✅ {asset.description || "Dado de Alta"}
                    </span>
                  )}
                </div>

                <div className="qr-sticker">
                  <div className="qr-sticker-left">
                    <img className="qr-sticker-logo" src={getLogoUrl(asset.module)} alt="logo" />
                    <div className="qr-sticker-divider" style={{ borderTopColor: getAccentColor(asset.module) }}>
                      <span className="qr-sticker-dot" style={{ background: getAccentColor(asset.module) }} />
                      <span className="qr-sticker-dot" style={{ background: getAccentColor(asset.module) }} />
                    </div>
                    <div className="qr-sticker-code" style={{ color: getAccentColor(asset.module) }}>
                      {asset.unique_code}
                    </div>
                  </div>
                  <img className="qr-sticker-qr" src={`data:image/png;base64,${asset.qr_data}`} alt={asset.unique_code} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .qr-sticker-grid { display:flex; flex-wrap:wrap; gap:16px; }
        .qr-sticker-wrapper {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sticker-status-pill {
          font-size: 0.72rem;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(0,0,0,0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .is-pending-wrapper .qr-sticker {
          border: 1.5px dashed rgba(217, 119, 6, 0.4);
        }
        .qr-sticker {
          background: white;
          color: #0f172a;
          border-radius: 6px;
          border: 1px solid rgba(0,0,0,0.12);
          width: 210px;
          height: 63px;
          padding: 5px 8px;
          box-sizing: border-box;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 7px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .qr-sticker-left {
          display:flex; flex-direction:column; align-items:center;
          justify-content:center; flex:1; gap:5px; overflow:hidden;
        }
        .qr-sticker-logo {
          max-width: 90px;
          max-height: 22px;
          object-fit: contain;
          display: block;
        }
        .qr-sticker-divider {
          width:100%; border-top:1.5px solid;
          display:flex; align-items:center; justify-content:space-between;
        }
        .qr-sticker-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: -3px;
        }
        .qr-sticker-code {
          font-weight: 800;
          font-size: 0.6rem;
          letter-spacing: 0.06em;
          text-align: center;
          white-space: nowrap;
          font-family: 'Courier New', monospace;
        }
        .qr-sticker-qr {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          display: block;
          border-radius: 2px;
        } 
        
        @media print {
          .no-print { display:none !important; }
          .app-layout > nav, .liquid-glass { display:none !important; }
          .page-container { max-width:none !important; padding:0 !important; margin:0 !important; }
          .qr-sticker-grid { display:flex; flex-wrap:wrap; gap:1.5mm; align-content:flex-start; padding:0; margin:0; }
          .qr-sticker-wrapper { margin: 0; padding: 0; }
          .qr-sticker {
            width: 5cm;
            height: 1.5cm;
            padding: 1mm 1.8mm;
            box-sizing: border-box;
            border: 0.3mm solid #bbb !important;
            border-radius: 0;
            break-inside: avoid;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 1.5mm;
            background: white;
            overflow: hidden;
            box-shadow: none !important;
          }
          .qr-sticker-left { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; gap:1.2mm; overflow:hidden; }
          .qr-sticker-logo {
            max-width: 32mm;
            max-height: 6mm;
            object-fit: contain;
            display: block;
          }
          .qr-sticker-divider { width:100%; border-top-width:0.3mm; }
          .qr-sticker-dot {
            width: 1mm;
            height: 1mm;
            margin-top: -0.5mm;
          }
          .qr-sticker-code {
            font-size: 5.5pt;
            letter-spacing: 0.08em;
            font-weight: 800;
          }
          .qr-sticker-qr {
            width: 1.2cm;
            height: 1.2cm;
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default QRCodes;