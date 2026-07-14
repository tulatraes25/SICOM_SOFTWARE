import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';
import { ROUTES } from '@/config/constants';

interface SidebarProps {
  role: 'admin' | 'technician' | 'supervisor' | 'responsible';
  onLogout?: () => void;
}

const menuItems: Record<string, { label: string; path: string; icon: React.ElementType; disabled?: boolean }[]> = {
  admin: [
    { label: 'Dashboard', path: ROUTES.ADMIN_DASHBOARD, icon: LayoutDashboard },
    { label: 'Clientes', path: ROUTES.ADMIN_CLIENTS, icon: Users },
    { label: 'Edificios', path: ROUTES.ADMIN_BUILDINGS, icon: Building2 },
    { label: 'Ascensores', path: ROUTES.ADMIN_ELEVATORS, icon: Wrench },
    { label: 'Expedientes', path: ROUTES.ADMIN_SERVICE_CASES, icon: FolderOpen },
    { label: 'Revisión de Servicios', path: '/admin/mantenimientos', icon: FileText },
    { label: 'Mi firma', path: '/perfil/firma', icon: FileSignature },
    { label: 'Configuración documental', path: '/admin/configuracion/documentos', icon: Settings },
    { label: 'Usuarios', path: ROUTES.ADMIN_USERS, icon: Users, disabled: true },
  ],
  technician: [
    { label: 'Dashboard', path: ROUTES.TECH_DASHBOARD, icon: LayoutDashboard },
    { label: 'Buscar Ascensor', path: '/tecnico/ascensores', icon: Search },
    { label: 'Mis Mantenimientos', path: '/tecnico/mantenimientos', icon: FileText },
    { label: 'Mi firma', path: '/perfil/firma', icon: FileSignature },
  ],
  supervisor: [
    { label: 'Dashboard', path: ROUTES.SUPERVISOR_DASHBOARD, icon: LayoutDashboard },
    { label: 'Revisiones', path: '/supervisor/revisiones', icon: FileText },
    { label: 'Informes Mensuales', path: '/supervisor/informes', icon: FileText },
    { label: 'Mi firma', path: '/perfil/firma', icon: FileSignature },
  ],
  responsible: [
    { label: 'Dashboard', path: ROUTES.RESPONSIBLE_DASHBOARD, icon: LayoutDashboard },
    { label: 'Mis Ascensores', path: ROUTES.RESPONSIBLE_DASHBOARD, icon: Building2 },
  ],
};

export default function Sidebar({ role, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const items = menuItems[role] || [];

  return (
    <>
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

            if (item.disabled) {
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 cursor-not-allowed"
                >
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
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
                onClick={() => setCollapsed(true)}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
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
