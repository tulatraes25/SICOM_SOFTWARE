import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { COMPANY_NAME, COMPANY_SLOGAN, COMPANY_WEBSITE } from '@/config/constants';
import logoSicom from '@/assets/logo-sicom.png';

interface ServiceRecordPDFProps {
  record: {
    service_date: string;
    service_type: string;
    operational_status_at_service?: string;
    conservation_status_at_service?: string;
    description?: string;
    observations?: string;
    technical_report?: string;
    final_report_text?: string;
    ai_report_draft?: string;
    status: string;
    approved_at?: string;
  };
  elevator: {
    code: string;
    manufacturer?: string;
    model?: string;
    elevator_type?: string;
    serial_number?: string;
    capacity_kg?: number;
    floors_served?: string;
    building?: {
      name: string;
      address: string;
      locality: string;
      province: string;
      client?: { name: string };
    };
  };
  technician?: { full_name: string };
  approvedBy?: { full_name: string };
  checklist?: Array<{ item_name: string; status: string; notes?: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  operativo: 'Operativo',
  operativo_con_observaciones: 'Operativo con observaciones',
  no_operativo: 'No operativo',
  fuera_de_servicio_preventivo: 'Fuera de servicio preventivo',
  fuera_de_servicio_por_reparacion: 'Fuera de servicio por reparación',
  conforme: 'Conforme',
  observado: 'Observado',
  requiere_reparacion: 'Requiere reparación',
  fuera_de_servicio: 'Fuera de servicio',
  pendiente_de_verificacion: 'Pendiente de verificación',
};

const CHECKLIST_STATUS: Record<string, string> = {
  ok: 'OK',
  needs_attention: 'Observado',
  failed: 'Requiere intervención',
  na: 'No aplica',
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.5 },
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#8DB600', paddingBottom: 12, marginBottom: 15 },
  logo: { width: 120, height: 45 },
  headerRight: { alignItems: 'flex-end', flex: 1, marginLeft: 15 },
  companyName: { fontSize: 12, fontWeight: 'bold', color: '#1a1a1a' },
  companySlogan: { fontSize: 7, color: '#666', marginTop: 2 },
  
  // Footer
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#8DB600', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 8, color: '#666' },
  footerPage: { fontSize: 8, color: '#8DB600' },
  
  // Title
  titleContainer: { backgroundColor: '#06172E', padding: 20, borderRadius: 8, marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#8DB600', textAlign: 'center', marginTop: 5 },
  
  // Sections
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#06172E', borderBottomWidth: 2, borderBottomColor: '#8DB600', paddingBottom: 5, marginBottom: 10 },
  
  // Data grid
  dataGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#f8fafc', borderRadius: 8, padding: 15 },
  dataItem: { width: '50%', marginBottom: 10 },
  dataLabel: { fontSize: 8, color: '#666', textTransform: 'uppercase', marginBottom: 2 },
  dataValue: { fontSize: 11, fontWeight: 'bold', color: '#1a1a1a' },
  
  // Content
  content: { fontSize: 10, lineHeight: 1.6, color: '#333' },
  
  // Checklist
  checklistHeader: { flexDirection: 'row', backgroundColor: '#06172E', padding: 8, borderRadius: 4 },
  checklistHeaderText: { color: '#ffffff', fontSize: 9, fontWeight: 'bold' },
  checklistRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 6 },
  checklistItemName: { width: '45%', fontSize: 9 },
  checklistItemStatus: { width: '25%', fontSize: 9, fontWeight: 'bold' },
  checklistItemNotes: { width: '30%', fontSize: 8, color: '#666' },
  
  // Status
  statusBox: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontSize: 9, fontWeight: 'bold' },
  statusOperativo: { backgroundColor: '#dcfce7', color: '#166534' },
  statusObservado: { backgroundColor: '#fef3c7', color: '#92400e' },
  statusRequiere: { backgroundColor: '#fee2e2', color: '#991b1b' },
});

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status || 'N/D';
}

function getStatusStyle(status: string) {
  if (['operativo', 'conforme'].includes(status)) return styles.statusOperativo;
  if (['operativo_con_observaciones', 'observado'].includes(status)) return styles.statusObservado;
  return styles.statusRequiere;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/D';
  try { return new Date(dateStr).toLocaleDateString('es-AR'); } catch { return dateStr; }
}

function getMainReportText(record: any): string {
  if (record.final_report_text?.trim()) return record.final_report_text;
  if (record.ai_report_draft?.trim()) return record.ai_report_draft;
  if (record.technical_report?.trim()) return record.technical_report;
  if (record.description?.trim()) return record.description;
  return 'No disponible';
}

// Header y Footer para cada página
const PageHeader = () => (
  <View style={styles.header}>
    <Image src={logoSicom} style={styles.logo} />
    <View style={styles.headerRight}>
      <Text style={styles.companySlogan}>{COMPANY_SLOGAN}</Text>
    </View>
  </View>
);

const PageFooter = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>{COMPANY_NAME} • {COMPANY_WEBSITE}</Text>
    <Text style={styles.footerPage}>Página {pageNumber} de {totalPages}</Text>
  </View>
);

export default function ServiceRecordPDF({
  record,
  elevator,
  checklist = [],
}: ServiceRecordPDFProps) {
  const building = elevator.building;
  const mainReport = getMainReportText(record);
  const hasOriginalReport = record.technical_report?.trim() && record.technical_report.trim() !== mainReport.trim();

  return (
    <Document>
      {/* PÁGINA 1: Portada + Ficha técnica */}
      <Page size="A4" style={styles.page}>
        <PageHeader />
        
        {/* Título */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>INFORME TÉCNICO DE MANTENIMIENTO</Text>
          <Text style={styles.subtitle}>Documento generado por el Sistema QR de Trazabilidad</Text>
        </View>

        {/* Ficha técnica */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FICHA TÉCNICA</Text>
          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>CLIENTE</Text>
              <Text style={styles.dataValue}>{building?.client?.name || 'N/D'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>EDIFICIO</Text>
              <Text style={styles.dataValue}>{building?.name || 'N/D'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>CÓDIGO ASCENSOR</Text>
              <Text style={styles.dataValue}>{elevator.code}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>UBICACIÓN</Text>
              <Text style={styles.dataValue}>{building?.address || 'N/D'}, {building?.locality || 'N/D'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>FABRICANTE</Text>
              <Text style={styles.dataValue}>{elevator.manufacturer?.trim() || 'N/D'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>MODELO</Text>
              <Text style={styles.dataValue}>{elevator.model?.trim() || 'N/D'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>TIPO</Text>
              <Text style={styles.dataValue}>{elevator.elevator_type || 'N/D'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>FECHA SERVICIO</Text>
              <Text style={styles.dataValue}>{formatDate(record.service_date)}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>ESTADO OPERATIVO</Text>
              <Text style={[styles.statusBox, getStatusStyle(record.operational_status_at_service || '')]}>
                {getStatusLabel(record.operational_status_at_service || '')}
              </Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>ESTADO CONSERVACIÓN</Text>
              <Text style={[styles.statusBox, getStatusStyle(record.conservation_status_at_service || '')]}>
                {getStatusLabel(record.conservation_status_at_service || '')}
              </Text>
            </View>
          </View>
        </View>

        {/* Informe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORME TÉCNICO</Text>
          <Text style={styles.content}>{mainReport}</Text>
        </View>

        <PageFooter pageNumber={1} totalPages={1} />
      </Page>

      {/* PÁGINA 2+: Checklist + Registro original */}
      {checklist.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader />
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CHECKLIST DE MANTENIMIENTO</Text>
            <View style={styles.checklistHeader}>
              <Text style={styles.checklistHeaderText}>ÍTEM</Text>
              <Text style={[styles.checklistHeaderText, { width: '25%' }]}>RESULTADO</Text>
              <Text style={[styles.checklistHeaderText, { width: '30%' }]}>NOTA</Text>
            </View>
            {checklist.map((item, index) => (
              <View key={index} style={styles.checklistRow}>
                <Text style={styles.checklistItemName}>{item.item_name}</Text>
                <Text style={styles.checklistItemStatus}>{CHECKLIST_STATUS[item.status] || item.status}</Text>
                <Text style={styles.checklistItemNotes}>{item.notes || '-'}</Text>
              </View>
            ))}
          </View>

          {hasOriginalReport && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>REGISTRO TÉCNICO ORIGINAL</Text>
              <Text style={styles.content}>{record.technical_report}</Text>
            </View>
          )}

          <PageFooter pageNumber={2} totalPages={2} />
        </Page>
      )}

      {/* Si no hay checklist, el informe va en página 2 */}
      {checklist.length === 0 && hasOriginalReport && (
        <Page size="A4" style={styles.page}>
          <PageHeader />
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REGISTRO TÉCNICO ORIGINAL</Text>
            <Text style={styles.content}>{record.technical_report}</Text>
          </View>
          <PageFooter pageNumber={2} totalPages={2} />
        </Page>
      )}
    </Document>
  );
}
