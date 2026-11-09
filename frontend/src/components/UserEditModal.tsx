import { useState, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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
  const [warehouseKeys, setWarehouseKeys] = useState<string[]>(() => {
    if (user.warehouses.length > 0) {
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
  const [fullName, setFullName] = useState(user.full_name ?? '');
  const [documentId, setDocumentId] = useState(user.document_id ?? '');
  const [cargo, setCargo] = useState(user.cargo ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargoOptions, setCargoOptions] = useState<string[]>([]);

  useEffect(() => {
    getRolePermissions().then((perms) => setCargoOptions(perms.map(p => p.cargo).sort())).catch(() => {});
  }, []);

  const toggleWarehouse = (key: string) => {
    setWarehouseKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
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
        full_name: fullName.trim(),
        document_id: documentId.trim(),
        warehouse_keys: warehouseKeys,
        cargo: cargo.trim() || undefined,
        email: email.trim() || undefined,
        role,
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px',
    }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Modificar Información del Usuario</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Actualiza datos de personal, gerentes o encargados (usuario: {user.username})
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '8px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Correo Electrónico</div>
            <input 
              type="email" 
              className="input-field" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="ejemplo@elitenutrition.com.co" 
            />
          </label>

          <label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Rol en el Sistema</div>
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {assignableRoles.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>

          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Bodegas con acceso {isMaster ? '(ninguna = ve todas)' : ''} {role === 'empleado' || role === 'salida' ? '(Selecciona la empresa a la que pertenece)' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '10px' }}>
              {assignableWarehouses.map((w) => (
                <label key={w.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={warehouseKeys.includes(w.key)}
                    onChange={() => toggleWarehouse(w.key)}
                  />
                  {w.name}
                </label>
              ))}
            </div>
          </div>

          <label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Cargo (define qué categorías de activos puede solicitar)
            </div>
            <input
              className="input-field"
              list="cargo-options-list"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ej. Gerente General, Administrador, Diseñador..."
            />
            <datalist id="cargo-options-list">
              {cargoOptions.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color, #e2e8f0)', padding: '8px 12px', borderRadius: '8px' }}>
            ℹ️ Si estás cambiando de persona (ej. nuevo gerente o responsable), el sistema actualizará automáticamente el nombre en los activos que estaban bajo su custodia para que no haya cruce de información.
          </div>

          {error && <p style={{ color: 'var(--danger-color)', fontSize: '0.9rem' }}>{error}</p>}

          {user.digital_signature_url && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Firma Digital Registrada
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <img
                  src={user.digital_signature_url}
                  alt="Firma del usuario"
                  style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default UserEditModal;
