import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { listMyServiceRecords } from '@/services/serviceRecords.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { Search, FileText, Clock, CheckCircle, Plus } from 'lucide-react';
import type { ServiceRecord } from '@/types/database';

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  in_review: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export default function TechDashboard() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadRecords();
    }
  }, [user]);

  const loadRecords = async () => {
    if (!user) return;
    try {
      const data = await listMyServiceRecords(user.id);
      setRecords(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const drafts = records.filter(r => r.status === 'draft');
  const submitted = records.filter(r => r.status === 'submitted' || r.status === 'in_review');
  const completed = records.filter(r => r.status === 'approved');

  const stats = [
    { label: 'Borradores', value: drafts.length, icon: FileText, color: 'text-gray-600' },
    { label: 'En Revisión', value: submitted.length, icon: Clock, color: 'text-warning' },
    { label: 'Aprobados', value: completed.length, icon: CheckCircle, color: 'text-success' },
  ];

  return (
    <DashboardLayout role="technician" title="Panel del Técnico">
      <div className="space-y-6">
        {/* Quick actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/tecnico/ascensores">
            <Button>
              <Search size={16} className="mr-2" />
              Buscar Ascensor
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* Recent records */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Mis Mantenimientos Recientes</h3>
            
            {loading ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No hay mantenimientos registrados</p>
                <Link to="/tecnico/ascensores">
                  <Button className="mt-4">
                    <Plus size={16} className="mr-2" />
                    Cargar Primer Mantenimiento
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {records.slice(0, 10).map((record) => {
                  const elevator = record.elevator as any;
                  return (
                    <Link
                      key={record.id}
                      to={`/tecnico/mantenimientos/${record.id}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-medium">{elevator?.code || '-'}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(record.service_date).toLocaleDateString('es-AR')} - {record.service_type}
                          </p>
                        </div>
                        <Badge variant={STATUS_BADGE_VARIANT[record.status] || 'default'}>
                          {SERVICE_STATUS_LABELS[record.status] || record.status}
                        </Badge>
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
