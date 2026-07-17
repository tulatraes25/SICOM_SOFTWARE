import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listPendingServiceRecords, listApprovedServiceRecords } from '@/services/supervisor.service';
import { listServiceOrders } from '@/services/serviceOrders.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { SERVICE_ORDER_STATUS_LABELS } from '@/types/database';
import { Eye, Clock, CheckCircle } from 'lucide-react';

type TabType = 'pending' | 'approved';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', submitted: 'info', in_review: 'warning', approved: 'success', rejected: 'danger',
  completed: 'info', changes_requested: 'warning',
};

export default function AdminServiceReviewPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        // Get pending maintenance records + completed service orders
        const [maintenance, orders] = await Promise.all([
          listPendingServiceRecords(),
          listServiceOrders({ status: 'completed' }),
        ]);
        const maintenanceItems = (maintenance || []).map((r: any) => ({ ...r, _origin: 'maintenance' }));
        const orderItems = (orders.data || []).map((o: any) => ({ ...o, _origin: 'service_order' }));
        setRecords([...maintenanceItems, ...orderItems]);
      } else {
        // Get approved maintenance records + approved service orders
        const [maintenance, orders] = await Promise.all([
          listApprovedServiceRecords(),
          listServiceOrders({ status: 'approved' }),
        ]);
        const maintenanceItems = (maintenance || []).map((r: any) => ({ ...r, _origin: 'maintenance' }));
        const orderItems = (orders.data || []).map((o: any) => ({ ...o, _origin: 'service_order' }));
        setRecords([...maintenanceItems, ...orderItems]);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Revisión de Servicios">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'pending' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('pending')}
          >
            <Clock size={16} className="mr-2" />
            Pendientes
          </Button>
          <Button
            variant={activeTab === 'approved' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('approved')}
          >
            <CheckCircle size={16} className="mr-2" />
            Aprobados
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">
                  {activeTab === 'pending' ? 'No hay elementos pendientes de revisión' : 'No hay elementos aprobados'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Origen</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">N.º</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Edificio</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ascensor</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r: any) => {
                      const isOrder = r._origin === 'service_order';
                      const caseNum = isOrder
                        ? (r.service_case as any)?.case_number
                        : (r.elevator as any)?.building?.client?.name ? undefined : undefined;
                      const caseMode = isOrder ? (r.service_case as any)?.numbering_mode : undefined;
                      const numLabel = isOrder
                        ? (caseMode === 'test' ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`)
                        : (r.elevator?.code || '-');
                      const status = isOrder ? SERVICE_ORDER_STATUS_LABELS[r.status as keyof typeof SERVICE_ORDER_STATUS_LABELS] || r.status : SERVICE_STATUS_LABELS[r.status] || r.status;

                      return (
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Badge variant={isOrder ? 'info' : 'default'}>
                              {isOrder ? 'Orden' : 'Mantenimiento'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-gray-900">{numLabel}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {isOrder ? (r.client as any)?.name : (r.elevator?.building?.client?.name || '-')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {isOrder ? (r.building as any)?.name : (r.elevator?.building?.name || '-')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {isOrder ? (r.elevator as any)?.code : (r.elevator?.code || '-')}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_BADGE[r.status]}>{status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Link to={isOrder ? `/admin/ordenes-servicio/${r.id}` : `/admin/mantenimientos/${r.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye size={14} />
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
