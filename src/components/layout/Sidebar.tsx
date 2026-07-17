import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTechnicianClaimAlerts } from '@/hooks/useTechnicianClaimAlerts';
import { useTechnicianOrderAlerts } from '@/hooks/useTechnicianOrderAlerts';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Wrench,
  FileText,
  Search,
  FolderOpen,
  FileSignature,
  Calculator,
  AlertTriangle,
} from 'lucide-react';
import { ROUTES } from '@/config/constants';

interface SidebarProps {
  role: 'admin' | 'technician' | 'supervisor' | 'responsible';
  onLogout?: () => void;
  badgeCounts?: Record<string, number>;
}

const menuItems: Record<string, { label: string; path: string; icon: React.ElementType; disabled?: boolean; badgeKey?: string }[]> = {
  admin: [
    { label: 'Dashboard', path: ROUTES.ADMIN_DASHBOARD, icon: LayoutDashboard },
    { label: 'Clientes', path: ROUTES.ADMIN_CLIENTS, icon: Users },
    { label: 'Edificios', path: ROUTES.ADMIN_BUILDINGS, icon: Building2 },
    { label: 'Ascensores', path: ROUTES.ADMIN_ELEVATORS, icon: Wrench },
    { label: 'Expedientes', path: ROUTES.ADMIN_SERVICE_CASES, icon: FolderOpen },
    { label: 'Presupuestos', path: '/admin/presupuestos', icon: Calculator },
    { label: 'Reclamos', path: '/admin/reclamos', icon: AlertTriangle },
    { label: 'Órdenes de Servicio', path: '/admin/ordenes-servicio', icon: Wrench },
    { label: 'Revisión de Servicios', path: '/admin/mantenimientos', icon: FileText },
    { label: 'Mi firma', path: '/perfil/firma', icon: FileSignature },
    { label: 'Configuración documental', path: '/admin/configuracion/documentos', icon: Settings },
    { label: 'Usuarios', path: ROUTES.ADMIN_USERS, icon: Users, disabled: true },
  ],
  technician: [
    { label: 'Dashboard', path: ROUTES.TECH_DASHBOARD, icon: LayoutDashboard },
    { label: 'Buscar Ascensor', path: '/tecnico/ascensores', icon: Search },
    { label: 'Mis Mantenimientos', path: '/tecnico/mantenimientos', icon: FileText },
    { label: 'Mis Reclamos', path: '/tecnico/reclamos', icon: AlertTriangle, badgeKey: 'claims' },
    { label: 'Mis Órdenes', path: '/tecnico/ordenes', icon: Wrench, badgeKey: 'orders' },
    { label: 'Mi firma', path: '/perfil/firma', icon: FileSignature },
  ],
  supervisor: [
    { label: 'Dashboard', path: ROUTES.SUPERVISOR_DASHBOARD, icon: LayoutDashboard },
    { label: 'Expedientes', path: ROUTES.ADMIN_SERVICE_CASES, icon: FolderOpen },
    { label: 'Reclamos', path: '/admin/reclamos', icon: AlertTriangle },
    { label: 'Órdenes de Servicio', path: '/admin/ordenes-servicio', icon: Wrench },
    { label: 'Revisión de Servicios', path: '/admin/mantenimientos', icon: FileText },
    { label: 'Informes Mensuales', path: '/supervisor/informes', icon: FileText },
    { label: 'Mi firma', path: '/perfil/firma', icon: FileSignature },
  ],
  responsible: [
    { label: 'Dashboard', path: ROUTES.RESPONSIBLE_DASHBOARD, icon: LayoutDashboard },
    { label: 'Mis Ascensores', path: ROUTES.RESPONSIBLE_DASHBOARD, icon: Building2 },
  ],
};

export default function Sidebar({ role, onLogout, badgeCounts = {} }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const items = menuItems[role] || [];
  const claimAlerts = useTechnicianClaimAlerts();
  const orderAlerts = useTechnicianOrderAlerts();
  const showClaimAlert = role === 'technician' && claimAlerts.newCount > 0 && !claimAlerts.loading;
  const showOrderAlert = role === 'technician' && orderAlerts.newCount > 0 && !orderAlerts.loading;

  return (
    <>
      <style>{`
        @keyframes claim-alarm {
          0%, 100% { background-color: rgb(220 38 38); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          50% { background-color: rgb(153 27 27); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }
        .claim-alarm { animation: claim-alarm 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .claim-alarm { animation: none; background-color: rgb(220 38 38) !important; } }
      `}</style>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full bg-white border-r border-gray-200 transition-all duration-300',
          'lg:relative lg:translate-x-0',
          collapsed ? '-translate-x-full lg:w-20' : 'translate-x-0 lg:w-64'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          {!collapsed && (
            <Link to={ROUTES.ADMIN_DASHBOARD} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="font-semibold text-gray-900">SICOM</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            const badge = item.badgeKey ? badgeCounts[item.badgeKey] || 0 : 0;

            // Technician claim alarm — replace normal link
            if (item.badgeKey === 'claims' && showClaimAlert && !collapsed) {
              return (
                <Link key={item.path} to="/tecnico/reclamos"
                  className="claim-alarm flex items-center gap-3 px-3 py-2.5 rounded-lg text-white font-bold border border-red-800 shadow-lg shadow-red-500/50"
                  onClick={() => setCollapsed(true)}
                  title={`Tenés ${claimAlerts.newCount} reclamo(s) nuevo(s) que requiere(n) atención`}
                  aria-label={`Tenés ${claimAlerts.newCount} reclamo(s) nuevo(s) que requiere(n) atención`}
                >
                  <span className="relative flex h-5 w-5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
                    <span className="relative inline-flex h-5 w-5 rounded-full bg-red-600 border-2 border-red-400" />
                  </span>
                  <span className="flex-1">Mis Reclamos</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-sm font-extrabold text-red-700">{claimAlerts.newCount}</span>
                </Link>
              );
            }

            // Collapsed alarm
            if (item.badgeKey === 'claims' && showClaimAlert && collapsed) {
              return (
                <Link key={item.path} to="/tecnico/reclamos"
                  className="claim-alarm flex items-center justify-center px-3 py-2.5 rounded-lg text-white border border-red-800 shadow-lg shadow-red-500/50"
                  onClick={() => setCollapsed(true)}
                  title={`Tenés ${claimAlerts.newCount} reclamo(s) nuevo(s)`}
                  aria-label={`Tenés ${claimAlerts.newCount} reclamo(s) nuevo(s)`}
                >
                  <span className="relative flex h-5 w-5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
                    <span className="relative inline-flex h-5 w-5 rounded-full bg-red-600 border-2 border-red-400" />
                  </span>
                </Link>
              );
            }

            // Technician order alarm
            if (item.badgeKey === 'orders' && showOrderAlert && !collapsed) {
              return (
                <Link key={item.path} to="/tecnico/ordenes"
                  className="claim-alarm flex items-center gap-3 px-3 py-2.5 rounded-lg text-white font-bold border border-red-800 shadow-lg shadow-red-500/50"
                  onClick={() => setCollapsed(true)}
                  title={`Tenés ${orderAlerts.newCount} orden(es) nueva(s)`}
                  aria-label={`Tenés ${orderAlerts.newCount} orden(es) nueva(s)`}
                >
                  <span className="relative flex h-5 w-5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
                    <span className="relative inline-flex h-5 w-5 rounded-full bg-red-600 border-2 border-red-400" />
                  </span>
                  <span className="flex-1">Mis Órdenes</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-sm font-extrabold text-red-700">{orderAlerts.newCount}</span>
                </Link>
              );
            }

            if (item.badgeKey === 'orders' && showOrderAlert && collapsed) {
              return (
                <Link key={item.path} to="/tecnico/ordenes"
                  className="claim-alarm flex items-center justify-center px-3 py-2.5 rounded-lg text-white border border-red-800 shadow-lg shadow-red-500/50"
                  onClick={() => setCollapsed(true)}
                  title={`Tenés ${orderAlerts.newCount} orden(es) nueva(s)`}
                  aria-label={`Tenés ${orderAlerts.newCount} orden(es) nueva(s)`}
                >
                  <span className="relative flex h-5 w-5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
                    <span className="relative inline-flex h-5 w-5 rounded-full bg-red-600 border-2 border-red-400" />
                  </span>
                </Link>
              );
            }

            if (item.disabled) {
              return (
                <div key={item.path} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 cursor-not-allowed">
                  <Icon size={20} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Próximamente</span>
                    </>
                  )}
                </div>
              );
            }

            return (
              <Link key={item.path} to={item.path}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors', isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}
                onClick={() => setCollapsed(true)}
              >
                <Icon size={20} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-danger text-white">{badge}</span>}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          {!collapsed && (
            <p className="text-xs text-gray-400 text-center mb-2">SICOM Patagonia SRL v1.0.0</p>
          )}
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors w-full"
          >
            <LogOut size={20} />
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
