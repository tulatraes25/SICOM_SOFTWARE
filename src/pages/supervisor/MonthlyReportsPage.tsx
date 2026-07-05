import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listMonthlyReports, getMonthlyReportStats } from '@/services/monthlyReports.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { FileText, Download, Eye, Clock, CheckCircle } from 'lucide-react';
import type { MonthlyReport } from '@/types/database';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  draft: 'default',
  reviewed: 'warning',
  approved: 'info',
  sent: 'success',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  reviewed: 'Revisado',
  approved: 'Aprobado',
  sent: 'Enviado',
};

export default function MonthlyReportsPage() {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, generated: 0, sent: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsData, statsData] = await Promise.all([
        listMonthlyReports(filterStatus ? { status: filterStatus } : undefined),
        getMonthlyReportStats(),
      ]);
      setReports(reportsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total', value: stats.total, icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
    { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Con PDF', value: stats.generated, icon: Download, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Enviados', value: stats.sent, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
  ];

  return (
    <DashboardLayout role="supervisor" title="Informes Mensuales">
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

        {/* Filters */}
        <div className="flex gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="reviewed">Revisado</option>
            <option value="approved">Aprobado</option>
            <option value="sent">Enviado</option>
          </select>
        </div>

        {/* List */}
        <Card>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No hay informes mensuales</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Período</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Ascensor</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Edificio</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">PDF</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Envío</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => {
                      const elevator = report.elevator as any;
                      return (
                        <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{report.period}</td>
                          <td className="py-3 px-4 font-mono">{elevator?.code || '-'}</td>
                          <td className="py-3 px-4 text-gray-600">{elevator?.building?.name || '-'}</td>
                          <td className="py-3 px-4">
                            <Badge variant={STATUS_BADGE[report.status] || 'default'}>
                              {STATUS_LABELS[report.status] || report.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {report.pdf_url ? (
                              <Badge variant="success">Generado</Badge>
                            ) : (
                              <Badge variant="default">Pendiente</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {report.sent_at ? (
                              <Badge variant="success">Enviado</Badge>
                            ) : (
                              <Badge variant="default">Pendiente</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link to={`/supervisor/informes/${report.id}`}>
                              <Button size="sm">
                                <Eye size={14} className="mr-1" />
                                Ver
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
