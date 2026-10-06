import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ScanLine, Search, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { getAssetByCode, type Asset } from '../api';
import AssetEditModal from '../components/AssetEditModal';

const getNextSequentialCode = (code: string): string | null => {
  const match = code.match(/^([A-Za-z]+-?)(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  const digits = match[2];
  const nextNum = parseInt(digits, 10) + 1;
  const nextDigits = String(nextNum).padStart(digits.length, '0');
  return `${prefix}${nextDigits}`;
};

const RegisterByCode = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const codeParam = searchParams.get('code');

  const [manualCode, setManualCode] = useState(codeParam || '');
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null);
  const [lastSaved, setLastSaved] = useState<{ code: string; nextCode: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const lookupCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    getAssetByCode(trimmed)
      .then((asset) => {
        setFoundAsset(asset);
        setManualCode(trimmed);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  // Carga automática si viene ?code= en la URL
  useEffect(() => {
    if (codeParam) {
      setManualCode(codeParam);
      lookupCode(codeParam);
    }
  }, [codeParam]);

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
        try {
          scanner.pause(true);
        } catch (e) {
          console.warn("Could not pause scanner", e);
        }
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

  const handleSaved = (savedAsset: Asset) => {
    const next = getNextSequentialCode(savedAsset.unique_code);
    setLastSaved({ code: savedAsset.unique_code, nextCode: next });
    setFoundAsset(null);
    setError(null);
    if (next) {
      setManualCode(next);
      setSearchParams({ code: next });
    } else {
      setManualCode('');
      setSearchParams({});
    }
  };

  const resetScan = () => {
    setFoundAsset(null);
    setError(null);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="header" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <h1 className="title">Registrar por Código</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Escaneá o ingresá el sticker generado para dar de alta el activo físico en secuencia.
          </p>
        </div>
      </div>

      {/* Banner de confirmación secuencial al guardar */}
      {lastSaved && (
        <div
          className="glass-panel"
          style={{
            background: 'rgba(52, 199, 89, 0.12)',
            border: '1px solid rgba(52, 199, 89, 0.35)',
            marginBottom: '20px',
            padding: '16px 20px',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} />
                ¡Activo {lastSaved.code} dado de alta exitosamente!
              </div>
              {lastSaved.nextCode && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Siguiente código correlativo en orden: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{lastSaved.nextCode}</strong>
                </div>
              )}
            </div>

            {lastSaved.nextCode && (
              <button
                className="btn btn-primary"
                onClick={() => lookupCode(lastSaved.nextCode!)}
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
              >
                <Sparkles size={16} />
                Registrar Siguiente ({lastSaved.nextCode})
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '16px' }}>
        <div id="register-reader" style={{ width: '100%', border: 'none' }}></div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ScanLine size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          Apunte la cámara al código QR del sticker
        </div>
      </div>

      <form onSubmit={handleManualSubmit} className="glass-panel" style={{ display: 'flex', gap: '12px', padding: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            className="input-field"
            style={{ paddingLeft: '38px' }}
            placeholder="O escribí el código manualmente (ej. FU-0301 o EE-0001)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || !manualCode.trim()}>
          {loading ? 'Buscando...' : 'Buscar Código'}
        </button>
      </form>

      {error && (
        <div className="glass-panel" style={{ color: 'var(--danger-color)', marginTop: '16px', textAlign: 'center', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.3)' }}>
          {error}
        </div>
      )}

      {foundAsset && (
        <AssetEditModal
          asset={foundAsset}
          onClose={resetScan}
          onSaved={handleSaved}
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
