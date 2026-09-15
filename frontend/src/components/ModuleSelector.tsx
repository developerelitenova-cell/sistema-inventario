import { useEffect, useState } from 'react';
import { useModule } from '../moduleContext';
import { useWarehouses } from '../warehouseContext';
import { getCachedUser } from './LoginGate';
import { createWarehouse, updateWarehouse, isMasterAdmin } from '../api';
import { Layers, Plus, Pencil, Check, X } from 'lucide-react';

interface ModuleSelectorProps {
  disabled?: boolean;
}

export default function ModuleSelector({ disabled }: ModuleSelectorProps) {
  const { module, setModule } = useModule();
  const { warehouses, reload } = useWarehouses();
  const currentUser = getCachedUser();
  const isMaster = isMasterAdmin(currentUser);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  // Igual que en el backend: sin bodegas asignadas = sin restricción (admin
  // maestro). Con bodegas asignadas, se ve solo esa lista -- aplica a
  // cualquier rol, incluido un admin acotado a su propia bodega.
  const accessibleKeys = currentUser && currentUser.warehouses.length > 0
    ? new Set(currentUser.warehouses.map((w) => w.key))
    : null;

  const visible = warehouses.filter((w) => w.is_active && (!accessibleKeys || accessibleKeys.has(w.key)));

  useEffect(() => {
    if (visible.length && !visible.some((w) => w.key === module)) {
      setModule(visible[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((w) => w.key).join(','), module]);

  const startRename = (id: number, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const saveRename = async (id: number) => {
    if (!renameValue.trim()) return;
    setSaving(true);
    try {
      await updateWarehouse(id, { name: renameValue.trim() });
      reload();
      setRenamingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const saveNewWarehouse = async () => {
    if (!newKey.trim() || !newName.trim()) return;
    setSaving(true);
    try {
      const created = await createWarehouse({ key: newKey.trim(), name: newName.trim() });
      reload();
      setModule(created.key);
      setAdding(false);
      setNewKey('');
      setNewName('');
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex justify-center my-6 px-4">
      <div
        className={`liquid-glass p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto scrollbar-hide shadow-sm max-w-full ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        style={{
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.08)'
        }}
      >
        {visible.map((w) => {
          const isActive = module === w.key;
          const isRenaming = renamingId === w.id;

          if (isRenaming) {
            return (
              <div key={w.key} className="flex items-center gap-1 px-2 py-1.5">
                <input
                  autoFocus
                  className="input-field"
                  style={{ padding: '4px 8px', fontSize: '0.85rem', width: '140px' }}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveRename(w.id)}
                />
                <button type="button" className="btn btn-outline" style={{ padding: '4px' }} disabled={saving} onClick={() => saveRename(w.id)}>
                  <Check size={14} />
                </button>
                <button type="button" className="btn btn-outline" style={{ padding: '4px' }} onClick={() => setRenamingId(null)}>
                  <X size={14} />
                </button>
              </div>
            );
          }

          return (
            <div key={w.key} className="flex items-center">
              <button
                onClick={() => setModule(w.key)}
                disabled={disabled}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-out whitespace-nowrap
                  ${isActive
                    ? 'bg-white text-[var(--gold-deep)] shadow-[0_2px_10px_rgba(0,0,0,0.08)] scale-100'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/50 scale-95'}
                `}
              >
                {isActive && <Layers size={16} />}
                {w.name}
              </button>
              {isMaster && (
                <button
                  type="button"
                  title="Renombrar bodega"
                  onClick={() => startRename(w.id, w.name)}
                  style={{ padding: '4px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          );
        })}

        {isMaster && (
          adding ? (
            <div className="flex items-center gap-1 px-2 py-1.5">
              <input
                autoFocus
                className="input-field"
                style={{ padding: '4px 8px', fontSize: '0.85rem', width: '110px' }}
                placeholder="Nombre"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="input-field"
                style={{ padding: '4px 8px', fontSize: '0.85rem', width: '90px' }}
                placeholder="clave"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <button type="button" className="btn btn-outline" style={{ padding: '4px' }} disabled={saving} onClick={saveNewWarehouse}>
                <Check size={14} />
              </button>
              <button type="button" className="btn btn-outline" style={{ padding: '4px' }} onClick={() => setAdding(false)}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="Agregar bodega"
              onClick={() => setAdding(true)}
              className="flex items-center justify-center px-3 py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/50"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={16} />
            </button>
          )
        )}
      </div>
    </div>
  );
}
