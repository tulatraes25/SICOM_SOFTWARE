import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getMonthlyReportById,
  sendMonthlyReport,
  getReportRecipients,
  getReportSends,
} from '@/services/monthlyReports.service';
import { usePDFGenerator } from '@/lib/pdf';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ReportPDF from '@/components/pdf/ReportPDF';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { COMPANY_NAME } from '@/config/constants';
import {
  ArrowLeft, Download, Send, FileText, Building2, User,
  Mail, CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import type { MonthlyReport, ReportRecipient, ReportSend } from '@/types/database';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  draft: 'default',
  generated: 'warning',
  reviewed: 'warning',
  approved: 'info',
  sent: 'success',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  generated: 'Generado',
  reviewed: 'Revisado',
  approved: 'Aprobado',
  sent: 'Enviado',
};

export default function MonthlyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { generateAndUpload, generating } = usePDFGenerator();
  
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [sends, setSends] = useState<ReportSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [reportData, recipientsData, sendsData] = await Promise.all([
        getMonthlyReportById(id),
        getReportRecipients(id),
        getReportSends(id),
      ]);
      setReport(reportData);
      setRecipients(recipientsData);
      setSends(sendsData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAndSavePDF = async () => {
    if (!id || !report) return;
    
    const elevator = report.elevator as any;
    const building = elevator?.building;
    const client = building?.client;

    await generateAndUpload(id, {
      report,
      elevator,
      building,
      client,
      supervisor: (report as any).approved_by_profile,
    });

    loadData();
  };

  const handleSend = async () => {
    if (!id) return;
    if (!report?.pdf_url) {
      alert('Primero debe generar el PDF');
      return;
    }
    if (recipients.length === 0) {
      alert('No hay destinatarios configurados');
      return;
    }
    if (!confirm('¿Enviar informe a todos los destinatarios?')) return;
    
    setSending(true);
    setSendResult(null);
    try {
      const result = await sendMonthlyReport(id);
      setSendResult(result);
      loadData();
    } catch (err) {
      console.error('Error:', err);
      alert('Error al enviar informe');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="supervisor" title="Detalle de Informe">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout role="supervisor" title="Detalle de Informe">
        <div className="text-center py-8">
          <p className="text-gray-500">Informe no encontrado</p>
        </div>
      </DashboardLayout>
    );
  }

  const elevator = report.elevator as any;
  const building = elevator?.building;
  const client = building?.client;
  const fileName = `informe-${elevator?.code || 'ascensor'}-${report.period}.pdf`;

  return (
    <DashboardLayout role="supervisor" title="Detalle de Informe">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button
            onClick={() => navigate('/supervisor/informes')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          
          <Badge variant={STATUS_BADGE[report.status] || 'default'}>
            {STATUS_LABELS[report.status] || report.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <Card>
              <CardContent>
                <div className="text-center border-b pb-4 mb-4">
                  <h1 className="text-2xl font-bold text-primary">{COMPANY_NAME}</h1>
                  <p className="text-gray-600">Informe Técnico Mensual</p>
                  <p className="text-lg font-semibold mt-2">Período: {report.period}</p>
                </div>
              </CardContent>
            </Card>

            {/* Elevator */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 size={18} /> Datos del Equipo
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Código</p>
                    <p className="font-mono font-bold">{elevator?.code || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Edificio</p>
                    <p className="font-medium">{building?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Dirección</p>
                    <p className="font-medium">{building?.address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cliente</p>
                    <p className="font-medium">{client?.name || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText size={18} /> Contenido del Informe
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {report.content || report.summary || 'No hay contenido disponible'}
                </div>
              </CardContent>
            </Card>

            {/* Approval */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4">Aprobación</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Aprobado por</p>
                    <p className="font-medium">{(report as any).approved_by_profile?.full_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha</p>
                    <p className="font-medium">
                      {report.approved_at ? new Date(report.approved_at).toLocaleDateString('es-AR') : '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Actions */}
          <div className="space-y-6">
            {/* PDF Actions */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4">PDF del Informe</h3>
                
                {report.pdf_url ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-success/10 rounded-lg">
                      <p className="text-sm text-success font-medium">✓ PDF generado y guardado</p>
                    </div>
                    
                    <PDFDownloadLink
                      document={
                        <ReportPDF
                          report={report}
                          elevator={elevator}
                          building={building}
                          client={client}
                          supervisor={(report as any).approved_by_profile}
                        />
                      }
                      fileName={fileName}
                    >
                      {({ loading: pdfLoading }) => (
                        <Button className="w-full" disabled={pdfLoading}>
                          {pdfLoading ? (
                            <>
                              <Loader2 size={16} className="mr-2 animate-spin" />
                              Generando...
                            </>
                          ) : (
                            <>
                              <Download size={16} className="mr-2" />
                              Descargar PDF
                            </>
                          )}
                        </Button>
                      )}
                    </PDFDownloadLink>
                    
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleGenerateAndSavePDF}
                      loading={generating}
                    >
                      Regenerar PDF
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">Aún no se generó el PDF</p>
                    <Button
                      className="w-full"
                      onClick={handleGenerateAndSavePDF}
                      loading={generating}
                    >
                      {generating ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Generando PDF...
                        </>
                      ) : (
                        <>
                          <Download size={16} className="mr-2" />
                          Generar y Guardar PDF
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Send email */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4">Enviar por Correo</h3>
                <Button
                  onClick={handleSend}
                  loading={sending}
                  className="w-full"
                  disabled={!report.pdf_url || recipients.length === 0}
                >
                  <Send size={16} className="mr-2" />
                  Enviar a {recipients.length} destinatarios
                </Button>
                {recipients.length === 0 && (
                  <p className="text-xs text-danger mt-2">No hay destinatarios configurados</p>
                )}
                {sendResult && (
                  <div className={`mt-4 p-3 rounded-lg ${sendResult.failed > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
                    <p className="text-sm font-medium">
                      {sendResult.success} enviados, {sendResult.failed} fallidos
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recipients */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Mail size={18} /> Destinatarios ({recipients.length})
                </h3>
                {recipients.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay destinatarios</p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        <User size={14} className="text-gray-400" />
                        <span>{r.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Send history */}
            {sends.length > 0 && (
              <Card>
                <CardContent>
                  <h3 className="font-semibold text-gray-900 mb-4">Historial</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {sends.map((send) => (
                      <div key={send.id} className="flex items-start gap-2 text-sm p-2 bg-gray-50 rounded">
                        {send.status === 'sent' ? (
                          <CheckCircle size={14} className="text-success mt-0.5" />
                        ) : (
                          <AlertCircle size={14} className="text-danger mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{send.recipient_name}</p>
                          <p className="text-gray-500">{send.recipient_email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
