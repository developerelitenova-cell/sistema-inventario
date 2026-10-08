import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { login, getMe, type User } from '../api';
import { getToken, setToken, clearToken } from '../session';
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
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px', textAlign: 'center', position: 'relative', zIndex: 10, background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#1e293b', padding: '36px 32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)' }}>
        
        {/* Logos de las empresas */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          <img src="/logo_elite_nutrition.jpeg" alt="Elite Nutrition" style={{ height: '42px', maxWidth: '120px', objectFit: 'contain', mixBlendMode: 'multiply' }} />
          <div style={{ width: '1px', height: '32px', background: '#cbd5e1' }} />
          <img src="/logo_futupro.png" alt="FutuPro" style={{ height: '38px', maxWidth: '120px', objectFit: 'contain', mixBlendMode: 'multiply' }} />
        </div>

        {/* Nombres de las empresas */}
        <div style={{ marginBottom: '4px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b08d57' }}>
          Elite Nutrition · FutuPro
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '6px', color: '#0f172a' }}>
          Control de Inventario y Activos
        </h2>
        <p style={{ color: '#64748b', marginBottom: '22px', fontSize: '0.88rem' }}>
          Portal corporativo oficial. Ingresá con tu cuenta autorizada.
        </p>

        <input
          type="email"
          className="input-field"
          placeholder="Correo corporativo (@elitenutrition o @futupro)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          style={{ marginBottom: '12px', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
        />
        <input
          type="password"
          className="input-field"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: '16px', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
        />
        {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px', background: '#fef2f2', padding: '8px', borderRadius: '8px', border: '1px solid #fecaca' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '16px', background: '#b08d57', color: 'white', border: 'none', padding: '12px', fontWeight: 600, fontSize: '0.95rem' }} disabled={submitting}>
          {submitting ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
        </button>
        <Link to="/register" style={{ color: '#b08d57', fontSize: '0.85rem', textDecoration: 'underline', fontWeight: 500 }}>
          ¿Todavía no tenés cuenta? Registrá tu perfil de colaborador
        </Link>
      </form>
    </div>
  );
};

export default LoginGate;
