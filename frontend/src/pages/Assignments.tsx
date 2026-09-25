import { useState, useEffect } from 'react';
import { RefreshCw, XCircle, Plus } from 'lucide-react';
import {
  getAssignments, createAssignment, renewAssignment, revokeAssignment, updateAssignment,
  getAssets, getUsers, type Assignment, type Asset, type User,
} from '../api';
import { useModule } from '../moduleContext';

const daysUntil = (isoDate: string) =>
  Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

const Assignments = () => {
  const { module } = useModule();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ assetId: '', userId: '', durationDays: '90', notes: '', securityAuthorization: 'INTERNO' });
  const [submitting, setSubmitting] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getAssignments('active'), getAssets(module), getUsers()])
      .then(([a, assets, u]) => {
        setAssignments(a.filter(x => x.asset.module === module));
        setAvailableAssets(assets.filter(x => x.status === 'available'));
        setUsers(u);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [module]);

  const handleCreate = async () => {
    if (!form.assetId || !form.userId) return;
    setSubmitting(true);
    try {
      await createAssignment(Number(form.assetId), Number(form.userId), null, Number(form.durationDays) || 90, form.notes, form.securityAuthorization);
      setForm({ assetId: '', userId: '', durationDays: '90', notes: '', securityAuthorization: 'INTERNO' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenew = async (id: number) => {
    await renewAssignment(id, 90);
    load();
  };

  const handleRevoke = async (id: number) => {
    await revokeAssignment(id);
    load();
  };

  const handleUpdate = async (id: number, security_authorization: string, notes: string) => {
    await updateAssignment(id, { security_authorization, notes });
    setEditingAssignment(null);
    load();
  };

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Asignaciones Temporales</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Activos asignados de forma prolongada a líderes de área, con vigencia renovable.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> Nueva asignación
        </button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select className="input-field" style={{ flex: 1, minWidth: '200px' }} value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
              <option value="">Seleccionar activo disponible...</option>
              {availableAssets.map(a => (
                <option key={a.id} value={a.id}>{a.unique_code} — {a.description}</option>
              ))}
            </select>
            <select className="input-field" style={{ flex: 1, minWidth: '200px' }} value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">Seleccionar líder...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
            <input
              className="input-field" style={{ width: '140px' }} type="number" min="1"
              value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
              placeholder="Días"
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select className="input-field" style={{ flex: 1, minWidth: '200px' }} value={form.securityAuthorization} onChange={(e) => setForm({ ...form, securityAuthorization: e.target.value })}>
              <option value="INTERNO">Activo para uso interno (No autorizado para salir)</option>
              <option value="AUTORIZADO_SALIDA">Activo autorizado para salir de la empresa</option>
            </select>
            <input className="input-field" style={{ flex: 2, minWidth: '200px' }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas (opcional)" />
          </div>
          <button className="btn btn-primary" onClick={handleCreate} disabled={submitting || !form.assetId || !form.userId}>
            {submitting ? 'Creando...' : 'Autorizar asignación'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : assignments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          No hay asignaciones activas en este módulo.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {assignments.map((a) => {
            const remaining = daysUntil(a.expiration_date);
            const expiringSoon = remaining <= 7;
            return (
              <div key={a.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                    {a.asset.description} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 400 }}>({a.asset.unique_code})</span>
                  </h3>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                    Asignado a: <strong style={{ color: 'var(--text-primary)' }}>{a.user.full_name}</strong>
                    {a.notes && <> · {a.notes}</>}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    {a.security_authorization === 'AUTORIZADO_SALIDA' ? (
                      <span className="badge badge-available" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>Autorizado para salir</span>
                    ) : (
                      <span className="badge badge-loaned" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>Uso interno</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span className={`badge ${expiringSoon ? 'badge-loaned' : 'badge-available'}`}>
                    {remaining >= 0 ? `Vence en ${remaining} días` : 'Vencida'}
                  </span>
                  <button className="btn btn-outline" onClick={() => setEditingAssignment(a)} title="Ver y Editar">
                    <RefreshCw size={16} /> Ver / Editar
                  </button>
                  <button className="btn btn-outline" onClick={() => handleRenew(a.id)} title="Renovar 90 días">
                    <RefreshCw size={16} />
                  </button>
                  <button className="btn" style={{ background: 'var(--danger-color)', color: 'white' }} onClick={() => handleRevoke(a.id)} title="Revocar">
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editingAssignment && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Detalles de Asignación</h2>
              <button type="button" onClick={() => setEditingAssignment(null)} className="btn btn-outline" style={{ border: 'none' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Activo</h3>
                {editingAssignment.asset.photo_url ? (
                  <a href={editingAssignment.asset.photo_url} target="_blank" rel="noreferrer">
                    <img src={editingAssignment.asset.photo_url} alt="Asset" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
                  </a>
                ) : (
                  <div style={{ width: '100%', height: '140px', background: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', marginBottom: '8px' }}>Sin foto</div>
                )}
                <strong>{editingAssignment.asset.description}</strong>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{editingAssignment.asset.unique_code}</div>
              </div>
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Responsable</h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                  {editingAssignment.user.photo_url ? (
                    <img src={editingAssignment.user.photo_url} alt="User" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: '50px', height: '50px', background: '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                  )}
                  <div>
                    <strong>{editingAssignment.user.full_name}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{editingAssignment.user.cargo || 'Sin cargo'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Permiso de Salida</h3>
              <select 
                className="input-field" 
                value={editingAssignment.security_authorization || 'INTERNO'} 
                onChange={(e) => setEditingAssignment({...editingAssignment, security_authorization: e.target.value})}
                style={{ width: '100%', marginBottom: '16px' }}
              >
                <option value="INTERNO">Uso interno (No autorizado para salir)</option>
                <option value="AUTORIZADO_SALIDA">Autorizado para salir de la empresa</option>
              </select>

              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Notas</h3>
              <input 
                className="input-field" 
                value={editingAssignment.notes || ''} 
                onChange={(e) => setEditingAssignment({...editingAssignment, notes: e.target.value})} 
                style={{ width: '100%', marginBottom: '24px' }} 
              />

              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleUpdate(editingAssignment.id, editingAssignment.security_authorization || 'INTERNO', editingAssignment.notes || '')}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assignments;
