import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ScanLine, Search } from 'lucide-react';
import { getAssetByCode, type Asset } from '../api';
import AssetEditModal from '../components/AssetEditModal';

const RegisterByCode = () => {
  const [manualCode, setManualCode] = useState('');
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const lookupCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    getAssetByCode(trimmed)
      .then(setFoundAsset)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (foundAsset) return; // no re-inicializar la cámara mientras el modal está abierto

    const scanner = new Html5QrcodeScanner(
      "register-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        videoConstraints: { facingMode: "environment" }
      },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        scanner.pause(true);
        lookupCode(decodedText);
      },
      () => {
        // Ignorar errores de frame vacío
      }
    );

    return () => {
      scannerRef.current = null;
      scanner.clear().catch((err) => console.error("Failed to clear html5QrcodeScanner.", err));
    };
  }, [foundAsset]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupCode(manualCode);
  };

  const resetScan = () => {
    setFoundAsset(null);
    setManualCode('');
    setError(null);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="header" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <h1 className="title">Registrar por Código</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Escaneá el sticker ya pegado en el activo para completar su registro.
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '16px' }}>
        <div id="register-reader" style={{ width: '100%', border: 'none' }}></div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ScanLine size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          Apunte la cámara al código QR del sticker
        </div>
      </div>

      <form onSubmit={handleManualSubmit} className="glass-panel" style={{ display: 'flex', gap: '12px', padding: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-secondary)' }} />
          <input
            className="input-field"
            style={{ paddingLeft: '38px' }}
            placeholder="O escribí el código manualmente (ej. EN-0001)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || !manualCode.trim()}>
          Buscar
        </button>
      </form>

      {error && (
        <p style={{ color: 'var(--danger-color)', marginTop: '16px', textAlign: 'center' }}>{error}</p>
      )}

      {foundAsset && (
        <AssetEditModal
          asset={foundAsset}
          onClose={resetScan}
          onSaved={resetScan}
        />
      )}

      <style>{`
        #register-reader button {
          background: var(--accent-color);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          margin-top: 10px;
        }
        #register-reader a { color: var(--accent-color); }
        #register-reader select {
          display: none !important;
          background: rgba(15,23,42,0.5);
          color: white;
          border: 1px solid var(--surface-border);
          padding: 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default RegisterByCode;
