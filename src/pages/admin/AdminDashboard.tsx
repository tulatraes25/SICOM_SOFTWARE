import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Building2, Users, Wrench, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    elevators: 0,
    clients: 0,
    pending: 0,
    alerts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [elevators, clients, pending, alerts] = await Promise.all([
        supabase.from('elevators').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('service_records').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'in_review']),
        supabase.from('service_records').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);

      setStats({
        elevators: elevators.count || 0,
        clients: clients.count || 0,
        pending: pending.count || 0,
        alerts: alerts.count || 0,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Ascensores', value: stats.elevators, icon: Building2, color: 'text-primary' },
    { label: 'Clientes Activos', value: stats.clients, icon: Users, color: 'text-success' },
    { label: 'Servicios Pendientes', value: stats.pending, icon: Wrench, color: 'text-warning' },
    { label: 'Rechazados', value: stats.alerts, icon: AlertTriangle, color: 'text-danger' },
  ];

  return (
    <DashboardLayout role="admin" title="Panel de Control">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {loading ? '-' : stat.value}
                      </p>
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
              Desde aquí podrás gestionar clientes, edificios, ascensores y revisar servicios enviados por técnicos.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
