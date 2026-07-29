import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getResponsibleMonthlyReports, getResponsibleElevators, getResponsibleBuildings, getResponsibleMonthlyReportDownload, getErrorMessage } from '@/services/responsiblePortalService';
import type { ResponsibleMonthlyReport, ResponsibleElevator, ResponsibleBuilding } from '@/services/responsiblePortalService';
import { FileText, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

const REPORT_STATUS_LABELS: Record<string, string> = { approved: 'Aprobado', sent: 'Enviado', draft: 'Borrador', pending: 'Pendiente', rejected: 'Rechazado' };
const naturalSort = new Intl.Collator('es', { numeric: true, sensitivity: 'base' }).compare;

export default function ResponsibleReportsPage() {
  const [reports, setReports] = useState<ResponsibleMonthlyReport[]>([]);
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [buildings, setBuildings] = useState<ResponsibleBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [rep, els, blds] = await Promise.all([getResponsibleMonthlyReports(), getResponsibleElevators(), getResponsibleBuildings()]);
      setReports(rep); setElevators(els); setBuildings(blds);
    } catch (err: unknown) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  };

  const handleDownload = async (reportId: string): Promise<void> => {
    setDownloadingReportId(reportId);
    setError('');
    try {
      const result = await getResponsibleMonthlyReportDownload(reportId);
      const a = document.createElement('a');
      a.href = result.signed_url;
      a.download = result.filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setDownloadingReportId(null);
    }
  };

  const elevatorMap = useMemo(() => new Map(elevators.map((e) => [e.id, e])), [elevators]);
  const buildingMap = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  const resolveInfo = (elevatorId: string) => {
    const el = elevatorMap.get(elevatorId);
    const bld = el ? buildingMap.get(el.building_id) : null;
    return { code: el?.code || '-', building: bld?.name || '-', hasResolvedElevator: !!el, hasResolvedBuilding: !!bld };
  };

  const getYearMonth = (r: ResponsibleMonthlyReport): { year: number; month: number } => {
    const validYear = Number.isInteger(r.report_year) && (r.report_year ?? 0) > 0;
    const validMonth = Number.isInteger(r.report_month) && (r.report_month ?? 0) >= 1 && (r.report_month ?? 0) <= 12;
    let year = validYear ? r.report_year! : 0;
    let month = validMonth ? r.report_month! : 0;
    if (!validYear || !validMonth) {
      const match = (r.period || '').match(/^(\d{4})-(\d{2})$/);
      if (match) {
        const pYear = parseInt(match[1], 10);
        const pMonth = parseInt(match[2], 10);
        if (!validYear && pYear > 0) year = pYear;
        if (!validMonth && pMonth >= 1 && pMonth <= 12) month = pMonth;
      }
    }
    return { year, month };
  };

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      const ay = getYearMonth(a); const by = getYearMonth(b);
      if (ay.year !== by.year) return by.year - ay.year;
      if (ay.month !== by.month) return by.month - ay.month;
      const pc = naturalSort(b.period || '', a.period || '');
      if (pc !== 0) return pc;
      const ai = resolveInfo(a.elevator_id); const bi = resolveInfo(b.elevator_id);
      const aComplete = ai.hasResolvedElevator && ai.hasResolvedBuilding;
      const bComplete = bi.hasResolvedElevator && bi.hasResolvedBuilding;
      if (aComplete && !bComplete) return -1;
      if (!aComplete && bComplete) return 1;
      const bnc = naturalSort(ai.building, bi.building);
      if (bnc !== 0) return bnc;
      const cc = naturalSort(ai.code, bi.code);
      if (cc !== 0) return cc;
      return naturalSort(a.id, b.id);
    });
  }, [reports, elevatorMap, buildingMap]);

  return (
    <DashboardLayout role="responsible" title="Informes Mensuales">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Informes Mensuales</h2>
          <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw size={14} className="mr-1" /> Actualizar</Button>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        ) : reports.length === 0 ? (
          <Card><CardContent><div className="text-center py-12"><FileText size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No hay informes disponibles</p></div></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {sortedReports.map((r) => {
              const info = resolveInfo(r.elevator_id);
              const isDownloading = downloadingReportId === r.id;
              return (
                <div key={r.id} data-testid={`responsible-report-${r.id}`}>
                <Card>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><p className="font-semibold text-gray-900">{info.code}</p><Badge variant={r.status === 'approved' ? 'success' : 'info'}>{REPORT_STATUS_LABELS[r.status] || r.status || '-'}</Badge></div>
                      <p className="text-sm text-gray-600">{info.building} — {r.period}</p>
                      {r.general_status && <p className="text-xs text-gray-500">Estado: {r.general_status}</p>}
                    </div>
                    <div>
                      {r.has_pdf ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={downloadingReportId !== null}
                          onClick={() => handleDownload(r.id)}
                          aria-label={`Descargar informe ${info.code} ${r.period}`}
                        >
                          {isDownloading ? (
                            <><Loader2 size={14} className="mr-1 animate-spin" /> Preparando...</>
                          ) : (
                            'Descargar PDF'
                          )}
                        </Button>
                      ) : (
                        <span className="text-sm text-gray-400">Sin PDF</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
