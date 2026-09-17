import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, QrCode, ClipboardCheck, AlertTriangle, UserCheck, Contact, LogOut, Users as UsersIcon, Inbox, PlusCircle, Grid3x3, ScrollText, PackageCheck, ScanLine, Calculator, MessageCircle, X, KeyRound } from 'lucide-react';
import { getCachedUser } from './LoginGate';
import { clearToken } from '../session';
import { getAssetRequests, isMasterAdmin, logoutApi } from '../api';
import { useModule } from '../moduleContext';
import logoIcon from '../assets/logo_elite_nova.png';
import ChangePasswordModal from './ChangePasswordModal';

const Navbar = () => {
  const location = useLocation();
  const currentUser = getCachedUser();
  const { module } = useModule();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } finally {
      clearToken();
      window.location.href = '/dashboard';
    }
  };

  const isEmpleado = currentUser?.role === 'empleado';
  const isAdmin = currentUser?.role === 'admin';
  const isEncargadoOrAdmin = currentUser?.role === 'encargado' || isAdmin;
  const isMaster = isMasterAdmin(currentUser);

  const [stockAlertCount, setStockAlertCount] = useState(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const [newMsgAlert, setNewMsgAlert] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      getAssetRequests('pending')
        .then((reqs) => {
          if (cancelled) return;
          
          if (isEncargadoOrAdmin) {
            const scoped = reqs.filter(r => r.module === module || r.module === null);
            setStockAlertCount(scoped.length);
          }

          // Check for unread comments
          let hasUnread = false;
          let senderName = '';
          for (const r of reqs) {
            if (r.comments && r.comments.length > 0) {
              const lastComment = r.comments[r.comments.length - 1];
              if (lastComment.author.id !== currentUser?.id) {
                const lastRead = localStorage.getItem(`read_msg_${r.id}`);
                if (!lastRead || new Date(lastComment.created_at) > new Date(lastRead)) {
                  hasUnread = true;
                  senderName = lastComment.author.full_name;
                  break; // found one unread, enough to trigger alert
                }
              }
            }
          }
          if (hasUnread) {
            setNewMsgAlert(`Nuevo mensaje de ${senderName}`);
          } else {
            setNewMsgAlert(null);
          }
        })
        .catch(() => {});
    };

    check();
    const interval = setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [module, isEncargadoOrAdmin, currentUser?.id]);

  const navItems = [
    { path: '/dashboard', label: isEmpleado ? 'Mi Solicitud' : 'Catálogo', icon: Package, show: currentUser?.role !== 'salida' },
    { path: '/approvals', label: 'Préstamos Pendientes', icon: ClipboardCheck, show: currentUser?.role !== 'salida' },
    { path: '/requests', label: 'Peticiones Generales', icon: Inbox, show: isEncargadoOrAdmin },
    { path: '/assets/new', label: 'Nuevo Activo', icon: PlusCircle, show: isEncargadoOrAdmin },
    { path: '/qr-codes', label: 'Códigos QR', icon: Grid3x3, show: isEncargadoOrAdmin },
    { path: '/assets/register-by-code', label: 'Registrar por Código', icon: ScanLine, show: isEncargadoOrAdmin },
    { path: '/scanner', label: 'Control Salida', icon: QrCode, show: !isEmpleado },
    { path: '/returns', label: 'Devoluciones', icon: PackageCheck, show: !isEmpleado && currentUser?.role !== 'salida' },
    { path: '/unused', label: 'Sin Uso', icon: AlertTriangle, show: isEncargadoOrAdmin },
    { path: '/assignments', label: 'Asignaciones', icon: UserCheck, show: isEncargadoOrAdmin },
    { path: '/responsibles', label: 'Personal', icon: Contact, show: isEncargadoOrAdmin },
    { path: '/accounting', label: 'Contabilidad', icon: Calculator, show: isMaster },
    { path: '/users', label: 'Usuarios', icon: UsersIcon, show: isAdmin },
    { path: '/logs', label: 'Logs', icon: ScrollText, show: isMaster },
  ].filter(item => item.show);

  return (
    <nav className="liquid-glass sticky top-0 z-50 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Top row on mobile: Logo and Logout */}
      <div className="flex items-center justify-between w-full md:w-auto">
        <div className="flex items-center gap-3" style={{ flexShrink: 0, marginRight: '8px' }}>
          <img src={logoIcon} alt="Elite Nova" style={{ height: '40px', width: 'auto', display: 'block', flexShrink: 0 }} />
        </div>

        {currentUser && (
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setShowPasswordModal(true)}
              title="Cambiar Contraseña"
              className="p-2 text-gray-600 hover:bg-black/5 rounded-xl border border-gray-200"
            >
              <KeyRound size={16} />
            </button>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Floating alert for new messages */}
      {newMsgAlert && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--accent)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '12px',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <MessageCircle size={18} />
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{newMsgAlert}</span>
          <button 
            onClick={() => setNewMsgAlert(null)}
            style={{ 
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', 
              cursor: 'pointer', padding: '4px', marginLeft: '4px', display: 'flex'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation Links - horizontally scrollable on mobile & desktop */}
      <div 
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`flex gap-2 overflow-x-auto pb-2 md:pb-0 flex-1 min-w-0 items-center px-1 hide-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => {
                if (isDragging) e.preventDefault();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl no-underline transition-all whitespace-nowrap text-sm ${
                isActive
                  ? 'text-white bg-[var(--gold)] font-semibold shadow-[0_0_12px_rgba(176,141,87,0.35)]'
                  : 'text-[var(--text-secondary)] hover:bg-black/5 font-medium'
              }`}
            >
              <Icon size={16} />
              {item.label}
              {item.path === '/requests' && stockAlertCount > 0 && (
                <span
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.9)' : 'var(--warning)',
                    color: isActive ? 'var(--gold)' : 'white',
                    borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                    minWidth: '18px', height: '18px', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                  }}
                >
                  {stockAlertCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* User action buttons for desktop */}
      {currentUser && (
        <div className="hidden md:flex items-center gap-2 ml-4">
          <button
            onClick={() => setShowPasswordModal(true)}
            title="Cambiar contraseña"
            className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <KeyRound size={14} /> Clave
          </button>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {currentUser.full_name} <LogOut size={16} />
          </button>
        </div>
      )}

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </nav>
  );
};

export default Navbar;
