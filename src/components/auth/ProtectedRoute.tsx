import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/roles';

const REQUIRED_PASSWORD_CHANGE_PATH = '/cambiar-contrasena-obligatoria';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  allowPasswordChangeRequired?: boolean;
}

export default function ProtectedRoute({ children, allowedRoles, allowPasswordChangeRequired }: ProtectedRouteProps) {
  const { user, profile, loading, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile.active) {
    void logout();
    return <Navigate to="/login" state={{ inactive: true }} replace />;
  }

  if (profile.must_change_password && !allowPasswordChangeRequired) {
    return <Navigate to={REQUIRED_PASSWORD_CHANGE_PATH} replace />;
  }

  if (!profile.must_change_password && allowPasswordChangeRequired) {
    return <Navigate to={profile.role === 'responsible' ? '/responsable' : `/admin`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso No Autorizado</h1>
          <p className="text-gray-600 mb-6">
            No tenés permisos para acceder a esta página.
          </p>
          <p className="text-sm text-gray-500">
            Tu rol actual: <span className="font-medium capitalize">{profile.role}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
