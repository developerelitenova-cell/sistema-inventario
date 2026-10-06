import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, QrCode, ClipboardCheck, AlertTriangle, UserCheck, Contact, LogOut, Users as UsersIcon, Inbox, PlusCircle, Grid3x3, ScrollText, PackageCheck, ScanLine, Calculator, MessageCircle, X, KeyRound, ChevronLeft, ChevronRight, ChevronDown, Building2 } from 'lucide-react';
import { getCachedUser } from './LoginGate';
import { clearToken } from '../session';
import { getAssetRequests, isMasterAdmin, logoutApi } from '../api';
import { useModule } from '../moduleContext';
import { useWarehouses } from '../warehouseContext';
import logoIcon from '../assets/logo_elite_nova.png';
import ChangePasswordModal from './ChangePasswordModal';

const Navbar = () => {
  const location = useLocation();
  const currentUser = getCachedUser();
  const { module, setModule } = useModule();
  const { warehouses } = useWarehouses();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } finally {
      clearToken();
      sessionStorage.removeItem('current_module');
      window.location.href = '/dashboard';
    }
  };

  const isEmpleado = currentUser?.role?.toLowerCase() === 'empleado';
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
  const isEncargadoOrAdmin = currentUser?.role?.toLowerCase() === 'encargado' || isAdmin;
  const isMaster = isMasterAdmin(currentUser);

  const [stockAlertCount, setStockAlertCount] = useState(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 2);
      // Small buffer for rounding issues
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    return () => clearTimeout(timer);
  }, [currentUser?.role, module, location.pathname]);

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
    { path: '/requests', label: 'Solicitudes', icon: Inbox, show: isEncargadoOrAdmin },
    { path: '/approvals', label: 'Préstamos Pendientes', icon: ClipboardCheck, show: currentUser?.role !== 'salida' },
    { path: '/assets/new', label: 'Nuevo Activo', icon: PlusCircle, show: isEncargadoOrAdmin },
    { path: '/assets/register-by-code', label: 'Registrar por Código', icon: ScanLine, show: isEncargadoOrAdmin },
    { path: '/qr-codes', label: 'Códigos QR', icon: Grid3x3, show: isEncargadoOrAdmin },
    { path: '/assignments', label: 'Asignaciones', icon: UserCheck, show: isEncargadoOrAdmin },
    { path: '/returns', label: 'Devoluciones', icon: PackageCheck, show: !isEmpleado && currentUser?.role !== 'salida' },
    { path: '/scanner', label: 'Control Salida', icon: QrCode, show: !isEmpleado },
    { path: '/unused', label: 'Sin Uso', icon: AlertTriangle, show: isEncargadoOrAdmin },
    { path: '/users', label: 'Usuarios', icon: UsersIcon, show: isAdmin },
    { path: '/responsibles', label: 'Personal', icon: Contact, show: isAdmin },
    { path: '/accounting', label: 'Contabilidad', icon: Calculator, show: isMaster },
    { path: '/warehouses', label: 'Bodegas', icon: Building2, show: isMaster },
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
      <div className="relative flex-1 min-w-0 flex items-center overflow-hidden rounded-xl">
        {/* Left fade indicator */}
        <button 
          onClick={() => scrollContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
          className={`absolute left-0 top-0 bottom-0 w-8 md:w-12 z-10 flex items-center justify-start transition-opacity duration-300 bg-gradient-to-r from-[rgba(255,255,255,0.95)] to-transparent cursor-pointer border-none outline-none ${canScrollLeft ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronLeft className="w-4 h-4 text-slate-500 ml-0.5" />
        </button>

        {/* Right fade indicator */}
        <button 
          onClick={() => scrollContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
          className={`absolute right-0 top-0 bottom-0 w-8 md:w-12 z-10 flex items-center justify-end transition-opacity duration-300 bg-gradient-to-l from-[rgba(255,255,255,0.95)] to-transparent cursor-pointer border-none outline-none ${canScrollRight ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronRight className="w-5 h-5 text-slate-600 mr-0.5 animate-pulse" />
        </button>

        <div 
          ref={scrollContainerRef}
          onScroll={checkScroll}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`flex gap-2 overflow-x-auto pb-2 md:pb-0 flex-1 min-w-0 items-center px-8 md:px-10 hide-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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
      </div>

      {/* User action buttons for desktop */}
      {currentUser && (
        <div className="hidden md:flex items-center gap-2 ml-4">
          {currentUser.warehouses && currentUser.warehouses.length > 0 && currentUser.role === 'empleado' && (
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap">
              🏢 {currentUser.warehouses[0].name}
            </span>
          )}
          {currentUser.role !== 'empleado' && (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 px-3 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
              >
                🏢 {warehouses.find(w => w.key === module)?.name || 'Módulo'} <ChevronDown size={14} />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                  {warehouses.filter(w => w.is_active).map(w => (
                    <button
                      key={w.key}
                      onClick={() => { setModule(w.key); setIsDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${module === w.key ? 'bg-[var(--gold)] text-white font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      {w.name}
                    </button>
                  ))}
                  {isMasterAdmin(currentUser) && (
                    <div className="border-t border-gray-100">
                      <Link to="/dashboard" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-2.5 text-xs text-center text-[var(--gold-deep)] hover:bg-gray-50 font-semibold transition-colors">
                        Gestión de Bodegas
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Badge del rol del usuario */}
          {(() => {
            const role = currentUser.role?.toLowerCase() || 'empleado';
            const badgeMeta = {
              admin: { label: 'Admin', icon: '👑', bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
              encargado: { label: 'Encargado', icon: '🔑', bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
              salida: { label: 'Vigilancia', icon: '🛡️', bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
              empleado: { label: 'Empleado', icon: '👤', bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
            }[role] || { label: currentUser.role, icon: '👤', bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };

            return (
              <span
                style={{
                  backgroundColor: badgeMeta.bg,
                  color: badgeMeta.text,
                  border: `1px solid ${badgeMeta.border}`,
                  padding: '4px 10px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
                title={currentUser.cargo ? `Cargo: ${currentUser.cargo}` : undefined}
              >
                <span>{badgeMeta.icon}</span>
                <span>{badgeMeta.label}</span>
                {currentUser.cargo && (
                  <span style={{ opacity: 0.75, fontWeight: 500, fontSize: '0.7rem' }}>
                    · {currentUser.cargo}
                  </span>
                )}
              </span>
            );
          })()}

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
