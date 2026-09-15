import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { CheckCircle, XCircle, ScanLine, AlertTriangle } from 'lucide-react';
import { verifyAsset, type VerificationResult } from '../api';

const Scanner = () => {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        setScanResult(decodedText);
        scanner.pause(true);
        handleVerify(decodedText);
      },
      () => {
        // Ignorar errores de frame vacío
      }
    );

    return () => {
      scanner.clear().catch(error => console.error("Failed to clear html5QrcodeScanner. ", error));
    };
  }, []);

  const handleVerify = (code: string) => {
    setError(null);
    verifyAsset(code)
      .then(setVerification)
      .catch((err) => {
        if (err.message?.includes('no encontrado')) {
          setVerification({
            asset_code: code,
            asset_description: 'Dispositivo Desconocido / No autorizado',
            status: 'available',
            is_authorized_to_leave: false,
            loan_status: null,
            loan_id: null,
            borrower_name: null,
            borrower_photo: null,
            borrower_document_id: null,
            borrower_signature: null,
          });
        } else {
          setError(err.message);
        }
      });
  };

  const resetScan = () => {
    setScanResult(null);
    setVerification(null);
    setError(null);
    // Para reanudar el scanner en un caso real tendríamos que reinicializarlo o usar resume()
    window.location.reload(); // Forma rápida de reiniciar el componente del scanner
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="header" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <h1 className="title">Control de Salidas</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Escanee el código QR del activo para autorizar su salida.</p>
        </div>
      </div>

      {!scanResult ? (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div id="reader" style={{ width: '100%', border: 'none' }}></div>
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ScanLine size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            Apunte la cámara al código QR del dispositivo
          </div>
        </div>
      ) : (
        <div className="glass-panel animate-fade-in" style={{ textAlign: 'center' }}>
          {error ? (
            <div style={{ color: 'var(--danger-color)', padding: '40px' }}>
              <XCircle size={64} style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>ERROR AL VERIFICAR</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
            </div>
          ) : verification ? (
            verification.is_authorized_to_leave && verification.loan_status === 'checked_out' ? (
              <div style={{ color: 'var(--text-secondary)' }}>
                <CheckCircle size={64} style={{ margin: '0 auto 16px', opacity: 0.6 }} />
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>SALIDA YA REGISTRADA</h2>
                <div style={{ marginBottom: '24px' }}>
                  <p style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>{verification.asset_description}</p>
                  <p>Este activo ya salió, prestado a: <strong style={{ color: 'var(--text-primary)' }}>{verification.borrower_name}</strong></p>
                </div>
              </div>
            ) : verification.is_authorized_to_leave ? (
              <div style={{ color: 'var(--success-color)' }}>
                <CheckCircle size={64} style={{ margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>SALIDA AUTORIZADA</h2>
                <div style={{ color: 'var(--text-primary)', marginBottom: '24px' }}>
                  <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{verification.asset_description}</p>
                  <p style={{ color: 'var(--text-secondary)' }}>Prestado a: <strong style={{ color: 'white' }}>{verification.borrower_name}</strong></p>
                </div>
                {verification.loan_id && (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginBottom: '16px', padding: '16px', fontSize: '1.1rem' }}
                      onClick={() => window.location.href = `/security-exit/${verification.loan_id}`}
                    >
                      Ver Pase de Salida
                    </button>
                )}
              </div>
            ) : verification.loan_status === 'pending' ? (
              <div style={{ color: '#f59e0b' }}>
                <AlertTriangle size={64} style={{ margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>SOLICITUD PENDIENTE</h2>
                <div style={{ color: 'var(--text-primary)', marginBottom: '24px' }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{verification.asset_description}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    <strong style={{ color: 'white' }}>{verification.borrower_name}</strong> ha solicitado este activo, pero la salida <strong>aún no ha sido aprobada</strong> por un encargado.
                  </p>
                </div>
              </div>
            ) : verification.loan_status === 'approved' ? (
              <div style={{ color: 'var(--danger-color)' }}>
                <XCircle size={64} style={{ margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '8px' }}>USO INTERNO — SIN SALIDA</h2>
                <div style={{ color: 'var(--text-primary)', marginBottom: '24px' }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{verification.asset_description}</p>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Asignado a <strong style={{ color: 'white' }}>{verification.borrower_name}</strong>, pero para uso interno — no tiene autorización para salir del edificio.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--danger-color)' }}>
                <XCircle size={64} style={{ margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>SALIDA DENEGADA</h2>
                <div style={{ color: 'var(--text-primary)', marginBottom: '24px' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Este dispositivo no tiene un préstamo activo aprobado.</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Código escaneado: {scanResult}</p>
                </div>
              </div>
            )
          ) : (
            <div style={{ padding: '40px' }}>Verificando en la base de datos...</div>
          )}

          <button className="btn btn-outline" onClick={resetScan} style={{ width: '100%' }}>
            Escanear Otro Activo
          </button>
        </div>
      )}

      {/* Estilos para el scanner de terceros */}
      <style>{`
        #reader button {
          background: var(--accent-color);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          margin-top: 10px;
        }
        #reader a { color: var(--accent-color); }
        #reader select {
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

export default Scanner;
