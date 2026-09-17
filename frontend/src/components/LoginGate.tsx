import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { login, getMe, type User } from '../api';
import { getToken, setToken, clearToken } from '../session';
import logoIcon from '../assets/logo_elite_nova.png';
import ThreeBackground from './ThreeBackground';

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
      <ThreeBackground />
      <form onSubmit={handleSubmit} className="glass-panel" style={{ width: '100%', maxWidth: '360px', textAlign: 'center', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white' }}>
        <img src={logoIcon} alt="Sistema de Activos" style={{ height: '56px', margin: '0 auto 16px', display: 'block', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '8px', color: 'white' }}>Sistema de Activos</h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Iniciá sesión con tu correo y contraseña.
        </p>
        <input
          type="email"
          className="input-field"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          style={{ marginBottom: '12px', background: 'rgba(0, 0, 0, 0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
        />
        <input
          type="password"
          className="input-field"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: '16px', background: 'rgba(0, 0, 0, 0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
        />
        {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '16px', background: '#b08d57', color: 'white', border: 'none' }} disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
        <Link to="/register" style={{ color: '#e8d9b5', fontSize: '0.85rem', textDecoration: 'underline' }}>
          ¿Todavía no tenés cuenta? Creá tu perfil
        </Link>
      </form>
    </div>
  );
};

export default LoginGate;
