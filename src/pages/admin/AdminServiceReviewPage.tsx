import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { listPendingServiceRecords, listApprovedServiceRecords } from '@/services/supervisor.service';
import { listServiceOrders } from '@/services/serviceOrders.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { SERVICE_ORDER_STATUS_LABELS } from '@/types/database';
import { Eye, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

type TabType = 'pending' | 'approved';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', submitted: 'info', in_review: 'warning', approved: 'success', rejected: 'danger',
  completed: 'info', changes_requested: 'warning',
};

interface ReviewItem {
  id: string;
  status: string;
  _origin: 'maintenance' | 'service_order';
  client?: { name?: string } | null;
  building?: { name?: string } | null;
  elevator?: { code?: string; building?: { name?: string; client?: { name?: string } | null } | null } | null;
  service_case?: { case_number?: number; numbering_mode?: string } | null;
}

export default function AdminServiceReviewPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [records, setRecords] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'pending') {
        const [maintenance, orders] = await Promise.all([
          listPendingServiceRecords(),
          listServiceOrders({ status: 'completed' }),
        ]);
        if (reqId !== requestIdRef.current) return;
        const maintenanceItems = (maintenance || []).map((r) => ({ ...r, _origin: 'maintenance' as const }));
        const orderItems = (orders.data || []).map((o) => ({ ...o, _origin: 'service_order' as const }));
        setRecords([...maintenanceItems, ...orderItems]);
      } else {
        const [maintenance, orders] = await Promise.all([
          listApprovedServiceRecords(),
          listServiceOrders({ status: 'approved' }),
        ]);
        if (reqId !== requestIdRef.current) return;
        const maintenanceItems = (maintenance || []).map((r) => ({ ...r, _origin: 'maintenance' as const }));
        const orderItems = (orders.data || []).map((o) => ({ ...o, _origin: 'service_order' as const }));
        setRecords([...maintenanceItems, ...orderItems]);
      }
    } catch {
      if (reqId !== requestIdRef.current) return;
      setRecords([]);
      setError('No se pudo cargar la revisión de servicios.');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
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

        {error && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
            <Button size="sm" variant="outline" onClick={loadData}><RefreshCw size={14} className="mr-1" /> Reintentar</Button>
          </div>
        )}

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
                    {records.map((r) => {
                      const isOrder = r._origin === 'service_order';
                      const caseNum = isOrder ? r.service_case?.case_number : undefined;
                      const caseMode = isOrder ? r.service_case?.numbering_mode : undefined;
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
                            {isOrder ? r.client?.name : r.elevator?.building?.client?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {isOrder ? r.building?.name : r.elevator?.building?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {isOrder ? r.elevator?.code : r.elevator?.code || '-'}
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
