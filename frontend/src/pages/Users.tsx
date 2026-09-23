import { useState, useEffect } from 'react';
import { Pencil, UserPlus, Trash2, Key, Copy, Check } from 'lucide-react';
import { getUsers, deleteUser, resetUserPassword, ROLE_LABELS, type User } from '../api';
import UserEditModal from '../components/UserEditModal';
import UserCreateModal from '../components/UserCreateModal';
import UserProfileCard from '../components/UserProfileCard';

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState<{ name: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getUsers().then(setUsers).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const handleDelete = (u: User) => {
    if (!window.confirm(`¿Borrar a ${u.full_name}? Esta acción no se puede deshacer.`)) return;
    setDeletingId(u.id);
    deleteUser(u.id)
      .then(() => setUsers((prev) => prev.filter((x) => x.id !== u.id)))
      .catch((err) => window.alert(err.message))
      .finally(() => setDeletingId(null));
  };

  const handleResetPassword = (u: User) => {
    if (!window.confirm(`¿Estás seguro de generar una nueva contraseña para ${u.full_name}?`)) return;
    
    resetUserPassword(u.id)
      .then((res) => {
        setResetPasswordData({ name: u.full_name, password: res.new_password });
        setCopied(false);
      })
      .catch((err) => window.alert(err.message));
  };

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h1 className="title">Usuarios</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Asigná bodegas y cargo a cada persona para que solo vea los activos que le corresponden al pedir un préstamo.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <UserPlus size={16} /> Crear usuario
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {users.map((u) => (
            <div key={u.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
              <UserProfileCard
                user={u}
                subtitle={`${ROLE_LABELS[u.role]} · ${u.warehouses.length ? u.warehouses.map(w => w.name).join(', ') : 'todas las bodegas'} · ${u.cargo || 'sin cargo'}`}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '8px' }} 
                  onClick={() => handleResetPassword(u)}
                  title="Generar nueva contraseña"
                >
                  <Key size={14} />
                </button>
                <button className="btn btn-outline" style={{ padding: '8px' }} onClick={() => setEditingUser(u)} title="Editar usuario">
                  <Pencil size={14} />
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '8px', color: 'var(--danger-color)' }}
                  disabled={deletingId === u.id}
                  onClick={() => handleDelete(u)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingUser && (
        <UserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => setUsers(users.map(u => (u.id === updated.id ? updated : u)))}
        />
      )}

      {creating && (
        <UserCreateModal
          onClose={() => setCreating(false)}
          onCreated={(created) => setUsers([created, ...users])}
        />
      )}

      {resetPasswordData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--success)', fontWeight: '600' }}>
              ¡Contraseña regenerada!
            </h2>
            <p style={{ marginBottom: '12px' }}>
              Nueva contraseña para <strong>{resetPasswordData.name}</strong>:
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                marginBottom: '16px',
                fontFamily: 'monospace',
                fontSize: '18px',
              }}
            >
              <span>{resetPasswordData.password}</span>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px', minWidth: '40px', justifyContent: 'center' }}
                onClick={() => {
                  navigator.clipboard.writeText(resetPasswordData.password);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                title="Copiar contraseña"
              >
                {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Por favor, copia esta contraseña de forma segura. <strong>No se volverá a mostrar</strong>.
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setResetPasswordData(null)}>
                Entendido, cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
