import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { login, getMe, type User } from '../api';
import { getToken, setToken, clearToken } from '../session';
import logoIcon from '../assets/logo_elite_nova.png';

interface LoginGateProps {
  children: ReactNode;
}

let cachedUser: User | null = null;
export const getCachedUser = () => cachedUser;

const LoginGate = ({ children }: LoginGateProps) => {
  const [status, setStatus] = useState<'checking' | 'authorized' | 'locked'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setStatus('locked');
      return;
    }
    getMe()
      .then((user) => {
        cachedUser = user;
        setStatus('authorized');
      })
      .catch(() => {
        clearToken();
        setStatus('locked');
      });
  }, []);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Verificando sesión...
      </div>
    );
  }

  if (status === 'authorized') {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await login(email, password);
      setToken(res.token);
      cachedUser = res.user;
      setStatus('authorized');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <img src={logoIcon} alt="Sistema de Activos" style={{ height: '56px', margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '8px' }}>Sistema de Activos</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Iniciá sesión con tu correo y contraseña.
        </p>
        <input
          type="email"
          className="input-field"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          style={{ marginBottom: '12px' }}
        />
        <input
          type="password"
          className="input-field"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: '16px' }}
        />
        {error && <p style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '16px' }} disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
        <Link to="/register" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
          ¿Todavía no tenés cuenta? Creá tu perfil
        </Link>
      </form>
    </div>
  );
};

export default LoginGate;
