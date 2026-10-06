import { useState, useEffect } from 'react';
import { Pencil, UserPlus, Key, Copy, Check, Search, UserCheck, UserX } from 'lucide-react';
import { getUsers, toggleUserActive, resetUserPassword, ROLE_LABELS, type User } from '../api';
import UserEditModal from '../components/UserEditModal';
import UserCreateModal from '../components/UserCreateModal';
import UserProfileCard from '../components/UserProfileCard';

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState<{ name: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getUsers().then(setUsers).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const handleToggleActive = (u: User) => {
    const isCurrentlyActive = u.is_active !== false;
    const msg = isCurrentlyActive
      ? `¿Deshabilitar a ${u.full_name}? El usuario no podrá iniciar sesión pero se conservará todo su historial de préstamos y asignaciones.`
      : `¿Reactivar el acceso de ${u.full_name}?`;

    if (!window.confirm(msg)) return;
    setTogglingId(u.id);
    toggleUserActive(u.id)
      .then((updated) => {
        setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      })
      .catch((err) => window.alert(err.message))
      .finally(() => setTogglingId(null));
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

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.document_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.cargo && u.cargo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase());

    const isActive = u.is_active !== false;
    if (statusFilter === 'active') return matchesSearch && isActive;
    if (statusFilter === 'inactive') return matchesSearch && !isActive;
    return matchesSearch;
  });

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

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '36px' }}
            placeholder="Buscar por nombre, documento, cargo o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '13px' }}
            onClick={() => setStatusFilter('all')}
          >
            Todos ({users.length})
          </button>
          <button
            className={`btn ${statusFilter === 'active' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '13px' }}
            onClick={() => setStatusFilter('active')}
          >
            Activos ({users.filter(x => x.is_active !== false).length})
          </button>
          <button
            className={`btn ${statusFilter === 'inactive' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 14px', fontSize: '13px' }}
            onClick={() => setStatusFilter('inactive')}
          >
            Inactivos ({users.filter(x => x.is_active === false).length})
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--danger-color)' }}>Error: {error}</div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          No se encontraron usuarios que coincidan con la búsqueda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredUsers.map((u) => {
            const isActive = u.is_active !== false;
            return (
              <div
                key={u.id}
                className="glass-panel"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  opacity: isActive ? 1 : 0.65,
                  borderLeft: isActive ? '3px solid var(--accent-color)' : '3px solid #888',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <UserProfileCard
                    user={u}
                    subtitle={`${ROLE_LABELS[u.role]} · ${u.warehouses.length ? u.warehouses.map(w => w.name).join(', ') : 'todas las bodegas'} · ${u.cargo || 'sin cargo'}`}
                  />
                  {!isActive && (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        color: 'var(--danger-color, #ef4444)',
                        fontWeight: '600',
                      }}
                    >
                      Inactivo
                    </span>
                  )}
                </div>
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
                    style={{
                      padding: '8px',
                      color: isActive ? 'var(--danger-color)' : 'var(--success-color, #10b981)',
                    }}
                    disabled={togglingId === u.id}
                    onClick={() => handleToggleActive(u)}
                    title={isActive ? 'Deshabilitar usuario (Soft Delete)' : 'Reactivar usuario'}
                  >
                    {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
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
