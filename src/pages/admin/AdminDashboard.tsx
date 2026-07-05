import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Building2, Users, Wrench, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const stats = [
    { label: 'Total Ascensores', value: '0', icon: Building2, color: 'text-primary' },
    { label: 'Clientes Activos', value: '0', icon: Users, color: 'text-success' },
    { label: 'Servicios Pendientes', value: '0', icon: Wrench, color: 'text-warning' },
    { label: 'Alertas', value: '0', icon: AlertTriangle, color: 'text-danger' },
  ];

  return (
    <DashboardLayout role="admin" title="Panel de Control">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg bg-gray-100 ${stat.color}`}>
                      <Icon size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bienvenido al Panel de Administración</h3>
            <p className="text-gray-600">
              Desde aquí podrás gestionar clientes, edificios, ascensores y usuarios del sistema.
              El módulo de estadísticas se habilitará cuando haya datos cargados.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
