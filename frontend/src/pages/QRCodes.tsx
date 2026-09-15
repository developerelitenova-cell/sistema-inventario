import { useState, useEffect } from "react";
import { Search, Printer, Sparkles } from "lucide-react";
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
  const { module } = useModule();
  const { warehouses } = useWarehouses();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [batchModule, setBatchModule] = useState<Module>(module);
  const [prefix, setPrefix] = useState(suggestPrefix(module));
  const [quantity, setQuantity] = useState(100);
  const [generating, setGenerating] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAssets(module)
      .then(setAssets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [module]);

  const handleGenerateBatch = async () => {
    if (!batchModule) {
      setBatchError("Debe seleccionar un módulo para generar los códigos QR. Sugerencia: Seleccione una bodega en el desplegable 'Módulo'.");
      return;
    }
    setGenerating(true);
    setBatchError(null);
    try {
      const newAssets = await batchGenerateAssets({ module: batchModule, prefix, quantity });
      if (batchModule === module) setAssets((prev) => [...prev, ...newAssets]);
      setOnlyPending(true);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const filtered = assets
    .filter((a) => !onlyPending || a.status === "pending_registration")
    .filter(
      (a) =>
        (a.description ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.unique_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="animate-fade-in">
      <div className="header no-print">
        <div>
          <h1 className="title">Codigos QR</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            {loading ? "Cargando..." : `${filtered.length} stickers listos para imprimir`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={18} /> Imprimir
        </button>
      </div>

      <div className="no-print glass-panel" style={{ marginBottom: "24px", padding: "20px", maxWidth: "640px" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: 0, marginBottom: "12px", fontSize: "1rem" }}>
          <Sparkles size={18} /> Generar lote de codigos
        </h3>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 140px" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Modulo</div>
            <select
              className="input-field"
              value={batchModule}
              onChange={(e) => {
                const m = e.target.value as Module;
                setBatchModule(m);
                setPrefix(suggestPrefix(m));
              }}
            >
              <option value="">Seleccione un módulo</option>
              {warehouses.map((w) => (
                <option key={w.key} value={w.key}>{w.name}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: "1 1 100px" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Prefijo</div>
            <input className="input-field" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
          </label>
          <label style={{ flex: "1 1 100px" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Cantidad</div>
            <input className="input-field" type="number" min={1} max={500} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </label>
          <button className="btn btn-primary" onClick={handleGenerateBatch} disabled={generating || !prefix}>
            {generating ? "Generando..." : "Generar e imprimir"}
          </button>
        </div>
        {batchError && <p style={{ color: "var(--danger-color)", fontSize: "0.9rem", marginTop: "8px" }}>{batchError}</p>}
      </div>

      <div className="no-print" style={{ marginBottom: "32px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", maxWidth: "400px", flex: "1 1 260px" }}>
          <Search size={20} style={{ position: "absolute", left: "16px", top: "12px", color: "var(--text-secondary)" }} />
          <input
            type="text"
            className="input-field"
            placeholder="Buscar por codigo o descripcion..."
            style={{ paddingLeft: "44px" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          Mostrar solo pendientes
        </label>
      </div>

      {loading ? (
        <div className="no-print" style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>Cargando...</div>
      ) : error ? (
        <div className="no-print" style={{ textAlign: "center", padding: "60px", color: "var(--danger-color)" }}>Error: {error}</div>
      ) : (
        <div className="qr-sticker-grid">
          {filtered.map((asset) => (
            <div key={asset.id} className="qr-sticker">
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
          ))}
        </div>
      )}

      <style>{`
        .qr-sticker-grid { display:flex; flex-wrap:wrap; gap:12px; }
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
        }.qr-sticker-divider {
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
        } @media print {
          .no-print { display:none !important; }
          .app-layout > nav, .liquid-glass { display:none !important; }
          .page-container { max-width:none !important; padding:0 !important; margin:0 !important; }
          .qr-sticker-grid { display:flex; flex-wrap:wrap; gap:1.5mm; align-content:flex-start; padding:0; margin:0; }
          .qr-sticker {
            width: 5cm;
            height: 1.5cm;
            padding: 1mm 1.8mm;
            box-sizing: border-box;
            border: 0.3mm solid #bbb;
            border-radius: 0;
            break-inside: avoid;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 1.5mm;
            background: white;
            overflow: hidden;
          }
          .qr-sticker-left { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; gap:1.2mm; overflow:hidden; }
          .qr-sticker-logo {
            max-width: 32mm;
            max-height: 6mm;
            object-fit: contain;
            display: block;
          }.qr-sticker-divider { width:100%; border-top-width:0.3mm; }
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
      `}</style>
    </div>
  );
};

export default QRCodes;