import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listPendingServiceRecords, listApprovedServiceRecords } from '@/services/supervisor.service';
import { listServiceOrders } from '@/services/serviceOrders.service';
import { listMonthlyReports } from '@/services/monthlyReportEnhanced.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { SERVICE_ORDER_STATUS_LABELS } from '@/types/database';
import { Eye, Clock, CheckCircle, AlertCircle, RefreshCw, FileText, Mail, ClipboardCheck } from 'lucide-react';

type TabType = 'pending' | 'approved' | 'monthly';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', submitted: 'info', in_review: 'warning', approved: 'success', rejected: 'danger',
  completed: 'info', changes_requested: 'warning',
};

const MONTHLY_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', generated: 'Generado', reviewed: 'Revisado', approved: 'Aprobado', sent: 'Enviado',
};
const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface ReviewItem {
  id: string;
  status: string;
  _origin: 'maintenance' | 'service_order';
  client?: { name?: string } | null;
  building?: { name?: string } | null;
  elevator?: { code?: string; building?: { name?: string; client?: { name?: string } | null } | null } | null;
  service_case?: { case_number?: number; numbering_mode?: string } | null;
}

interface MonthlyReviewItem {
  id: string;
  elevator_id?: string | null;
  report_month?: number | null;
  report_year?: number | null;
  period?: string | null;
  status: string;
  elevator?: { code?: string; building?: { name?: string } | null } | null;
}

export default function AdminServiceReviewPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(searchParams.get('tab') === 'monthly' ? 'monthly' : 'pending');
  const [records, setRecords] = useState<ReviewItem[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const selectedElevator = searchParams.get('elevator_id');
  const selectedPeriod = searchParams.get('period');

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'monthly') {
        const reports = await listMonthlyReports();
        if (reqId !== requestIdRef.current) return;
        setMonthlyReports(reports as unknown as MonthlyReviewItem[]);
      } else if (activeTab === 'pending') {
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
      setMonthlyReports([]);
      setError('No se pudo cargar la revisión de servicios.');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  };

  const visibleMonthlyReports = monthlyReports.filter((r) => {
    if (selectedElevator && r.elevator_id !== selectedElevator) return false;
    if (selectedPeriod && `${r.report_year}-${String(r.report_month).padStart(2, '0')}` !== selectedPeriod) return false;
    return true;
  });

  return (
    <DashboardLayout role="admin" title="Revisión de Servicios">
      <div className="space-y-4 2xl:space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <Card>
            <CardContent>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ClipboardCheck size={19} className="text-secondary" /> Etapa 1 · Validación del mantenimiento</h2>
              <p className="text-sm text-gray-600 mt-2">
                Revisá el trabajo del técnico. Al aprobarlo, se registra la fecha real del servicio y se actualiza la información del QR público.
                No se aprueba ni envía el informe mensual.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileText size={19} className="text-secondary" /> Etapa 2 · Informe mensual</h2>
              <p className="text-sm text-gray-600 mt-2">
                Con los mantenimientos validados, generá y revisá el PDF mensual. Su aprobación posterior habilita el envío a los destinatarios.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Etapas de revisión">
          <Button variant={activeTab === 'pending' ? 'primary' : 'outline'} onClick={() => setActiveTab('pending')}>
            <Clock size={16} className="mr-2" /> Pendientes
          </Button>
          <Button variant={activeTab === 'approved' ? 'primary' : 'outline'} onClick={() => setActiveTab('approved')}>
            <CheckCircle size={16} className="mr-2" /> Aprobados
          </Button>
          <Button variant={activeTab === 'monthly' ? 'primary' : 'outline'} onClick={() => setActiveTab('monthly')}>
            <Mail size={16} className="mr-2" /> Informes mensuales
          </Button>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
            <Button size="sm" variant="outline" onClick={loadData}><RefreshCw size={14} className="mr-1" /> Reintentar</Button>
          </div>
        )}

        {activeTab === 'monthly' ? (
          <Card>
            <CardContent className="p-0">
              <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-900">Aprobación y envío de informes mensuales</h3>
                  <p className="text-sm text-gray-500">Esta instancia es independiente de la fecha y estado del mantenimiento publicados en el QR.</p>
                  {(selectedElevator || selectedPeriod) && (
                    <p className="text-sm text-secondary mt-1">Mostrando el ascensor y período seleccionados desde el mantenimiento.</p>
                  )}
                </div>
                <Link to="/admin/informes-mensuales"><Button size="sm" variant="outline">Crear informe mensual</Button></Link>
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
              ) : visibleMonthlyReports.length === 0 ? (
                <div className="text-center py-10">
                  <FileText size={42} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No hay informes mensuales para esta selección.</p>
                  <p className="text-sm text-gray-500 mt-1">El mantenimiento puede figurar en el QR aunque su informe mensual aún no exista.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Período</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ascensor</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Edificio</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado del informe</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMonthlyReports.map((r) => (
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">{MONTH_NAMES[r.report_month || 0] || 'Mes'} {r.report_year || ''}</td>
                          <td className="px-4 py-3 font-mono">{r.elevator?.code || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.elevator?.building?.name || '-'}</td>
                          <td className="px-4 py-3"><Badge variant={r.status === 'sent' ? 'success' : r.status === 'approved' ? 'info' : 'warning'}>{MONTHLY_STATUS_LABELS[r.status] || r.status}</Badge></td>
                          <td className="px-4 py-3 text-right">
                            <Link to={`/admin/informes-mensuales/${r.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye size={14} className="mr-1" />
                                {r.status === 'approved' ? 'Revisar envío' : r.status === 'generated' ? 'Revisar y aprobar' : 'Ver informe'}
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
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
                            <td className="px-4 py-3"><Badge variant={isOrder ? 'info' : 'default'}>{isOrder ? 'Orden' : 'Mantenimiento'}</Badge></td>
                            <td className="px-4 py-3 font-mono font-semibold text-gray-900">{numLabel}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{isOrder ? r.client?.name : r.elevator?.building?.client?.name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{isOrder ? r.building?.name : r.elevator?.building?.name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{r.elevator?.code || '-'}</td>
                            <td className="px-4 py-3"><Badge variant={STATUS_BADGE[r.status]}>{status}</Badge></td>
                            <td className="px-4 py-3">
                              <Link to={isOrder ? `/admin/ordenes-servicio/${r.id}` : `/admin/mantenimientos/${r.id}`}>
                                <Button variant="ghost" size="sm"><Eye size={14} /></Button>
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
        )}
      </div>
    </DashboardLayout>
  );
}
