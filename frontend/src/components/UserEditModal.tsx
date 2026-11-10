import { useState, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, KeyRound, AlertTriangle } from 'lucide-react';
import { updateUser, getRolePermissions, ROLE_LABELS, isMasterAdmin, type User, type Role } from '../api';
import { useWarehouses } from '../warehouseContext';
import { getCachedUser } from './LoginGate';

interface UserEditModalProps {
  user: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}

const UserEditModal = ({ user, onClose, onSaved }: UserEditModalProps) => {
  const { warehouses } = useWarehouses();
  const actingUser = getCachedUser();
  const isMaster = isMasterAdmin(actingUser);
  const ownKeys = new Set((actingUser?.warehouses ?? []).map((w) => w.key));
  const assignableWarehouses = isMaster ? warehouses : warehouses.filter((w) => ownKeys.has(w.key));
  const assignableRoles = (Object.keys(ROLE_LABELS) as Role[]).filter((r) => isMaster || r !== 'admin');

  const [fullName, setFullName] = useState(user.full_name ?? '');
  const [documentId, setDocumentId] = useState(user.document_id ?? '');
  const [username, setUsername] = useState(user.username ?? '');
  const [cargo, setCargo] = useState(user.cargo ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargoOptions, setCargoOptions] = useState<string[]>([]);

  const [warehouseKeys, setWarehouseKeys] = useState<string[]>(() => {
    if (user.warehouses && user.warehouses.length > 0) {
      return user.warehouses.map((w) => w.key);
    }
    const emailLower = (user.email ?? '').toLowerCase();
    if (emailLower.includes('@futupro')) {
      const futu = assignableWarehouses.find((w) => w.key.includes('futu'));
      if (futu) return [futu.key];
    } else if (emailLower.includes('@elitenutrition') || emailLower.includes('@elitenova')) {
      const elite = assignableWarehouses.find((w) => w.key.includes('elite'));
      if (elite) return [elite.key];
    }
    return [];
  });

  useEffect(() => {
    getRolePermissions().then((perms) => setCargoOptions(perms.map(p => p.cargo).sort())).catch(() => {});
  }, []);

  const toggleWarehouse = (key: string) => {
    setWarehouseKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    setShowPassword(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('El nombre completo es obligatorio');
      return;
    }
    if (!documentId.trim()) {
      setError('El documento de identidad es obligatorio');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateUser(user.id, {
        username: username.trim().toLowerCase() || undefined,
        full_name: fullName.trim(),
        document_id: documentId.trim(),
        warehouse_keys: warehouseKeys,
        cargo: cargo.trim() || undefined,
        email: email.trim() || undefined,
        role,
        password: password.trim() || undefined,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px',
    }}>
      <form 
        onSubmit={handleSubmit} 
        className="glass-panel" 
        style={{ 
          width: '100%', 
          maxWidth: '640px', 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          background: 'var(--panel-bg, #ffffff)'
        }}
      >
        {/* Header fijo */}
        <div style={{ 
          padding: '16px 24px', 
          borderBottom: '1px solid var(--border-color, #e2e8f0)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'var(--panel-bg, #ffffff)',
          flexShrink: 0
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Modificar Información del Usuario
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Actualiza datos de personal, gerentes o encargados (ID #{user.id})
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-outline" 
            style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div style={{ 
          padding: '20px 24px', 
          overflowY: 'auto', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px' 
        }}>
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #f87171',
              color: '#991b1b',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <div><strong>Error al guardar:</strong> {error}</div>
            </div>
          )}

          <div style={{ 
            fontSize: '0.82rem', 
            color: '#1e3a8a', 
            background: '#eff6ff', 
            border: '1px solid #bfdbfe', 
            padding: '10px 14px', 
            borderRadius: '8px',
            lineHeight: 1.45
          }}>
            ℹ️ <strong>¿Cambio de persona o gerente?</strong> Puedes modificar el nombre completo, documento, correo, usuario y contraseña. El sistema transferirá y mantendrá automáticamente la custodia de los activos vinculados para evitar cualquier cruce de información.
          </div>

          {/* Grid de 2 columnas para campos principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            <label>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Nombre Completo <span style={{ color: 'var(--danger-color)' }}>*</span>
              </div>
              <input 
                type="text" 
                className="input-field" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Ej. Juan Carlos Pérez Gómez"
                required 
              />
            </label>

            <label>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Documento de Identidad / Cédula <span style={{ color: 'var(--danger-color)' }}>*</span>
              </div>
              <input 
                type="text" 
                className="input-field" 
                value={documentId} 
                onChange={(e) => setDocumentId(e.target.value)} 
                placeholder="Ej. 1020304050"
                required 
              />
            </label>

            <label>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Nombre de Usuario (Login)
              </div>
              <input 
                type="text" 
                className="input-field" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Ej. jaime.malpica.perez"
              />
            </label>

            <label>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Correo Electrónico
              </div>
              <input 
                type="email" 
                className="input-field" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="ejemplo@futupro.com" 
              />
            </label>

            <label>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Rol en el Sistema
              </div>
              <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {assignableRoles.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </label>

            <label>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Cargo (define categorías de activos permitidos)
              </div>
              <input
                className="input-field"
                list="cargo-options-list"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ej. Gerente General, Administrador..."
              />
              <datalist id="cargo-options-list">
                {cargoOptions.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>

          {/* Sección de Cambio / Generación de Contraseña */}
          <div style={{ 
            background: 'var(--bg-secondary, #f8fafc)', 
            border: '1px solid var(--border-color, #e2e8f0)', 
            borderRadius: '10px', 
            padding: '14px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Nueva Contraseña de Acceso (Opcional)
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-outline" 
                onClick={handleGeneratePassword}
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px' }}
              >
                <KeyRound size={14} /> Generar Clave
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
              Dejá este campo vacío para conservar la contraseña actual. Si ingresás un valor, se actualizará la clave del usuario.
            </p>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="input-field" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Escribí una nueva clave o hacé clic en Generar Clave"
                style={{ paddingRight: '42px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(p => !p)} 
                style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer',
                  padding: '4px'
                }}
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Bodegas */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Bodegas con acceso {isMaster ? '(ninguna = ve todas las bodegas)' : ''}
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '8px', 
              maxHeight: '140px', 
              overflowY: 'auto', 
              border: '1px solid var(--border-color, #e2e8f0)', 
              borderRadius: '8px', 
              padding: '12px',
              background: 'var(--panel-bg, #ffffff)'
            }}>
              {assignableWarehouses.map((w) => (
                <label 
                  key={w.key} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '0.88rem', 
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={warehouseKeys.includes(w.key)}
                    onChange={() => toggleWarehouse(w.key)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{w.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Firma Digital si existe */}
          {user.digital_signature_url && (
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Firma Digital Registrada
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <img
                  src={user.digital_signature_url}
                  alt="Firma del usuario"
                  style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer FIJO y STICKY en la parte inferior */}
        <div style={{ 
          padding: '14px 24px', 
          borderTop: '1px solid var(--border-color, #e2e8f0)', 
          background: 'var(--panel-bg, #ffffff)', 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end', 
          alignItems: 'center',
          flexShrink: 0
        }}>
          {error && (
            <span style={{ fontSize: '0.8rem', color: 'var(--danger-color)', marginRight: 'auto', fontWeight: 500 }}>
              ⚠️ Revisa los campos señalados
            </span>
          )}
          <button 
            type="button" 
            className="btn btn-outline" 
            style={{ minWidth: '110px' }} 
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ minWidth: '150px' }} 
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default UserEditModal;