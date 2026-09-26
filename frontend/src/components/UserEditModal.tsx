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
  const [warehouseKeys, setWarehouseKeys] = useState<string[]>(user.warehouses.map((w) => w.key));
  const [cargo, setCargo] = useState(user.cargo ?? '');
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
    setSaving(true);
    setError(null);
    try {
      const saved = await updateUser(user.id, {
        warehouse_keys: warehouseKeys,
        cargo: cargo || undefined,
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
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{user.full_name}</h2>
          <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '8px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Rol</div>
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
            <select className="input-field" value={cargo} onChange={(e) => setCargo(e.target.value)}>
              <option value="">Sin asignar (ve todas las categorías de su módulo)</option>
              {cargoOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

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
