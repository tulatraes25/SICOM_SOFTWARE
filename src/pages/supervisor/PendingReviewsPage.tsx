import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listPendingServiceRecords, listApprovedServiceRecords } from '@/services/supervisor.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { Eye, Clock, CheckCircle } from 'lucide-react';
import type { ServiceRecord } from '@/types/database';

type TabType = 'pending' | 'approved';

export default function PendingReviewsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = activeTab === 'pending' 
        ? await listPendingServiceRecords()
        : await listApprovedServiceRecords();
      setRecords(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = filterStatus
    ? records.filter(r => r.status === filterStatus)
    : records;

  return (
    <DashboardLayout role="supervisor" title="Revisiones">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock size={16} className="inline mr-2" />
            Pendientes
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'approved'
                ? 'bg-success text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <CheckCircle size={16} className="inline mr-2" />
            Aprobados
          </button>
        </div>

        {/* Filters */}
        {activeTab === 'pending' && (
          <div className="flex gap-4">
            <div className="w-48">
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'submitted', label: 'Enviados' },
                  { value: 'in_review', label: 'En Revisión' },
                  { value: 'rejected', label: 'Rechazados' },
                ]}
              />
            </div>
          </div>
        )}

        {/* List */}
        <Card>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {activeTab === 'pending' ? 'No hay registros pendientes' : 'No hay registros aprobados'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Ascensor</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Técnico</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Tipo</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => {
                      const elevator = record.elevator as any;
                      const technician = record.technician as any;
                      const client = elevator?.building?.client;
                      return (
                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-mono font-medium">{elevator?.code || '-'}</td>
                          <td className="py-3 px-4 text-gray-600">{client?.name || '-'}</td>
                          <td className="py-3 px-4 text-gray-600">{technician?.full_name || '-'}</td>
                          <td className="py-3 px-4 text-gray-600">
                            {new Date(record.service_date).toLocaleDateString('es-AR')}
                          </td>
                          <td className="py-3 px-4 text-gray-600 capitalize">{record.service_type}</td>
                          <td className="py-3 px-4">
                            <Badge variant={
                              record.status === 'submitted' ? 'info' :
                              record.status === 'in_review' ? 'warning' :
                              record.status === 'rejected' ? 'danger' :
                              record.status === 'approved' ? 'success' : 'default'
                            }>
                              {SERVICE_STATUS_LABELS[record.status as keyof typeof SERVICE_STATUS_LABELS] || record.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link to={`/supervisor/revisiones/${record.id}`}>
                              <Button size="sm">
                                <Eye size={14} className="mr-1" />
                                Revisar
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
