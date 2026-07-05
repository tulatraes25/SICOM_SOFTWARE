import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS, STATUS_COLORS } from '@/types/elevators';
import { Building2, FileText, Eye, MapPin } from 'lucide-react';

export default function ResponsibleDashboard() {
  const { user } = useAuth();
  const [elevators, setElevators] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [elevatorsData, reportsData] = await Promise.all([
        supabase
          .from('elevators')
          .select('id, code, operational_status, conservation_status, building:buildings(name, address, locality)')
          .eq('responsible_user_id', user.id)
          .eq('active', true)
          .order('code'),
        supabase
          .from('monthly_reports')
          .select('id, period, status, pdf_url, elevator:elevators(code)')
          .in('status', ['approved', 'sent']),
      ]);
      setElevators(elevatorsData.data || []);
      setReports(reportsData.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Mis Ascensores', value: elevators.length, icon: Building2, color: 'text-primary' },
    { label: 'Informes Disponibles', value: reports.length, icon: FileText, color: 'text-success' },
  ];

  return (
    <DashboardLayout role="responsible" title="Panel del Responsable">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* My elevators */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Mis Ascensores Asignados</h3>
            {loading ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : elevators.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No tiene ascensores asignados actualmente.
              </p>
            ) : (
              <div className="space-y-3">
                {elevators.map((elevator) => (
                  <div key={elevator.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-lg">{elevator.code}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building2 size={14} />
                          <span>{elevator.building?.name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <MapPin size={14} />
                          <span>{elevator.building?.address}, {elevator.building?.locality}</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge className={STATUS_COLORS[elevator.operational_status] || ''}>
                            {OPERATIONAL_STATUS_LABELS[elevator.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || elevator.operational_status}
                          </Badge>
                          <Badge className={STATUS_COLORS[elevator.conservation_status] || ''}>
                            {CONSERVATION_STATUS_LABELS[elevator.conservation_status as keyof typeof CONSERVATION_STATUS_LABELS] || elevator.conservation_status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reports */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Informes Disponibles</h3>
            {reports.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No hay informes aprobados disponibles.
              </p>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium">{report.elevator?.code || '-'}</p>
                      <p className="text-sm text-gray-600">Período: {report.period}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {report.pdf_url && (
                        <a href={report.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">
                            <Eye size={14} className="mr-1" />
                            Ver PDF
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
