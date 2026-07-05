import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listPendingServiceRecords, getSupervisorStats } from '@/services/supervisor.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { FileText, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import type { ServiceRecord } from '@/types/database';

export default function SupervisorDashboard() {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [stats, setStats] = useState({ submitted: 0, inReview: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [recordsData, statsData] = await Promise.all([
        listPendingServiceRecords(),
        getSupervisorStats(),
      ]);
      setRecords(recordsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Pendientes', value: stats.submitted, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
    { label: 'En Revisión', value: stats.inReview, icon: FileText, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Aprobados', value: stats.approved, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Rechazados', value: stats.rejected, icon: XCircle, color: 'text-danger', bg: 'bg-danger/10' },
  ];

  return (
    <DashboardLayout role="supervisor" title="Panel del Supervisor">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                      <Icon size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick access */}
        <Link to="/supervisor/revisiones">
          <Button>
            <Eye size={16} className="mr-2" />
            Ver Todas las Revisiones
          </Button>
        </Link>

        {/* Pending list */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Registros Pendientes de Revisión</h3>
            
            {loading ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No hay registros pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.slice(0, 10).map((record) => {
                  const elevator = record.elevator as any;
                  const technician = record.technician as any;
                  return (
                    <Link
                      key={record.id}
                      to={`/supervisor/revisiones/${record.id}`}
                      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{elevator?.code || '-'}</span>
                            <Badge variant={
                              record.status === 'submitted' ? 'info' :
                              record.status === 'in_review' ? 'warning' :
                              record.status === 'rejected' ? 'danger' : 'default'
                            }>
                              {SERVICE_STATUS_LABELS[record.status as keyof typeof SERVICE_STATUS_LABELS] || record.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {elevator?.building?.name} - {technician?.full_name || 'Técnico'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(record.service_date).toLocaleDateString('es-AR')} - {record.service_type}
                          </p>
                        </div>
                        <Button size="sm">
                          Revisar
                        </Button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
