import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTechnicianClaimAlerts } from '@/hooks/useTechnicianClaimAlerts';
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
  AlertCircle,
  Bell,
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
    { label: 'Mi firma', path: '/perfil/firma', icon: FileSignature },
  ],
  supervisor: [
    { label: 'Dashboard', path: ROUTES.SUPERVISOR_DASHBOARD, icon: LayoutDashboard },
    { label: 'Expedientes', path: ROUTES.ADMIN_SERVICE_CASES, icon: FolderOpen },
    { label: 'Reclamos', path: '/admin/reclamos', icon: AlertTriangle },
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
  const showClaimAlert = role === 'technician' && claimAlerts.newCount > 0 && !claimAlerts.loading;

  return (
    <>
      <style>{`
        @keyframes claim-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .claim-pulse { animation: none !important; }
        }
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

            // Technician claim alert — replace normal link with alert card
            if (item.badgeKey === 'claims' && showClaimAlert && !collapsed) {
              const isUrgent = claimAlerts.highestPriority === 'urgent';
              const isHigh = claimAlerts.highestPriority === 'high';
              const alertBg = isUrgent ? 'bg-red-600' : isHigh ? 'bg-orange-500' : 'bg-amber-500';
              const alertBorder = isUrgent ? 'border-red-700' : isHigh ? 'border-orange-600' : 'border-amber-600';
              const alertText = isUrgent ? 'RECLAMO URGENTE' : isHigh ? 'RECLAMO DE ALTA PRIORIDAD' : 'NUEVO RECLAMO';
              const alertSubtext = claimAlerts.newCount === 1 ? '1 tarea pendiente' : `${claimAlerts.newCount} tareas pendientes`;

              return (
                <Link key={item.path} to="/tecnico/reclamos"
                  className={cn(
                    'block rounded-lg border-2 p-3 mb-2 transition-all',
                    alertBg, alertBorder, 'text-white shadow-lg',
                    'animate-[claim-pulse_1.5s_ease-in-out_infinite]'
                  )}
                  style={{ animation: 'claim-pulse 1.5s ease-in-out infinite' }}
                  onClick={() => setCollapsed(true)}
                  aria-label={`Tenés ${claimAlerts.newCount} nuevo(s) reclamo(s) que requiere(n) atención`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={18} />
                    <span className="font-bold text-sm">{alertText}</span>
                  </div>
                  <p className="text-xs opacity-90 mb-1">Requiere atención</p>
                  <p className="text-xs font-medium opacity-80">{alertSubtext}</p>
                  <p className="text-xs mt-2 font-bold underline">Ver ahora →</p>
                </Link>
              );
            }

            // Collapsed alert icon
            if (item.badgeKey === 'claims' && showClaimAlert && collapsed) {
              return (
                <Link key={item.path} to="/tecnico/reclamos"
                  className={cn(
                    'flex items-center justify-center px-3 py-2.5 rounded-lg transition-colors',
                    'bg-red-500 text-white animate-[claim-pulse_1.5s_ease-in-out_infinite]'
                  )}
                  style={{ animation: 'claim-pulse 1.5s ease-in-out infinite' }}
                  onClick={() => setCollapsed(true)}
                  aria-label={`Tenés ${claimAlerts.newCount} nuevo(s) reclamo(s)`}
                >
                  <Bell size={20} />
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
