import { useAuth } from '@/hooks/useAuth';
import Sidebar from './Sidebar';
import Header from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'admin' | 'technician' | 'supervisor' | 'responsible';
  title: string;
}

export default function DashboardLayout({
  children,
  role,
  title,
}: DashboardLayoutProps) {
  const { profile, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={role} onLogout={logout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={title}
          userName={profile?.full_name || 'Usuario'}
          userEmail={profile?.email}
          userRole={profile?.role}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
