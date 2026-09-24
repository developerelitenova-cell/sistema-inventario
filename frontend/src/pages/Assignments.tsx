import { useState, useEffect } from 'react';
import { RefreshCw, XCircle, Plus } from 'lucide-react';
import {
  getAssignments, createAssignment, renewAssignment, revokeAssignment,
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
    </div>
  );
};

export default Assignments;
