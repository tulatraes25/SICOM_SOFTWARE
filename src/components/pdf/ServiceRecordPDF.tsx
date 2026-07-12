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

const STATUS_COLORS: Record<string, string> = {
  operativo: '#166534',
  operativo_con_observaciones: '#92400e',
  no_operativo: '#991b1b',
  fuera_de_servicio_preventivo: '#991b1b',
  fuera_de_servicio_por_reparacion: '#991b1b',
  conforme: '#166534',
  observado: '#92400e',
  requiere_reparacion: '#991b1b',
  fuera_de_servicio: '#991b1b',
  pendiente_de_verificacion: '#92400e',
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#8DB600', paddingBottom: 15, marginBottom: 20 },
  logo: { width: 100, height: 45 },
  headerRight: { alignItems: 'flex-end', flex: 1, marginLeft: 15 },
  companyName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  companySlogan: { fontSize: 7, color: '#666', marginTop: 2, maxWidth: 200 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#8DB600', textAlign: 'center', marginBottom: 15 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#8DB600', paddingBottom: 4, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  col: { width: '50%', marginBottom: 6 },
  colThird: { width: '33%', marginBottom: 6 },
  label: { fontSize: 8, color: '#666', textTransform: 'uppercase' },
  value: { fontSize: 10, fontWeight: 'bold' },
  content: { fontSize: 10, lineHeight: 1.6 },
  footer: { marginTop: 30, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#8DB600', fontSize: 8, color: '#666', textAlign: 'center' },
  footerWebsite: { color: '#8DB600', marginTop: 5 },
  checklistItem: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 5 },
  checklistName: { width: '45%', fontSize: 9 },
  checklistStatus: { width: '25%', fontSize: 9, fontWeight: 'bold' },
  checklistNotes: { width: '30%', fontSize: 8, color: '#666' },
});

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status || 'N/D';
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || '#333';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/D';
  try {
    return new Date(dateStr).toLocaleDateString('es-AR');
  } catch {
    return dateStr;
  }
}

function getMainReportText(record: any): string {
  if (record.final_report_text && record.final_report_text.trim()) return record.final_report_text;
  if (record.ai_report_draft && record.ai_report_draft.trim()) return record.ai_report_draft;
  if (record.technical_report && record.technical_report.trim()) return record.technical_report;
  if (record.description && record.description.trim()) return record.description;
  return 'No disponible';
}

export default function ServiceRecordPDF({
  record,
  elevator,
  technician,
  approvedBy,
  checklist = [],
}: ServiceRecordPDFProps) {
  const building = elevator.building;
  const mainReport = getMainReportText(record);
  const hasOriginalReport = record.technical_report && record.technical_report.trim() && record.technical_report.trim() !== mainReport.trim();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image src={logoSicom} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.companySlogan}>{COMPANY_SLOGAN}</Text>
          </View>
        </View>

        <Text style={styles.title}>INFORME TÉCNICO DE MANTENIMIENTO</Text>

        {/* Datos del Equipo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATOS DEL EQUIPO</Text>
          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>CÓDIGO</Text><Text style={styles.value}>{elevator.code}</Text></View>
            <View style={styles.col}><Text style={styles.label}>CLIENTE</Text><Text style={styles.value}>{building?.client?.name || 'N/D'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>EDIFICIO</Text><Text style={styles.value}>{building?.name || 'N/D'}</Text></View>
            <View style={styles.col}><Text style={styles.label}>DIRECCIÓN</Text><Text style={styles.value}>{building?.address || 'N/D'}, {building?.locality || 'N/D'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>FABRICANTE</Text><Text style={styles.value}>{elevator.manufacturer?.trim() || 'N/D'}</Text></View>
            <View style={styles.col}><Text style={styles.label}>MODELO</Text><Text style={styles.value}>{elevator.model?.trim() || 'N/D'}</Text></View>
          </View>
          {elevator.elevator_type && (
            <View style={styles.row}>
              <View style={styles.col}><Text style={styles.label}>TIPO</Text><Text style={styles.value}>{elevator.elevator_type}</Text></View>
              {elevator.serial_number && <View style={styles.col}><Text style={styles.label}>N° SERIE</Text><Text style={styles.value}>{elevator.serial_number}</Text></View>}
            </View>
          )}
        </View>

        {/* Datos del Servicio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATOS DEL SERVICIO</Text>
          <View style={styles.row}>
            <View style={styles.colThird}><Text style={styles.label}>FECHA</Text><Text style={styles.value}>{formatDate(record.service_date)}</Text></View>
            <View style={styles.colThird}><Text style={styles.label}>TIPO</Text><Text style={styles.value}>{record.service_type}</Text></View>
            <View style={styles.colThird}><Text style={styles.label}>TÉCNICO</Text><Text style={styles.value}>{technician?.full_name || 'N/D'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>ESTADO OPERATIVO</Text>
              <Text style={[styles.value, { color: getStatusColor(record.operational_status_at_service || '') }]}>
                {getStatusLabel(record.operational_status_at_service || '')}
              </Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>ESTADO CONSERVACIÓN</Text>
              <Text style={[styles.value, { color: getStatusColor(record.conservation_status_at_service || '') }]}>
                {getStatusLabel(record.conservation_status_at_service || '')}
              </Text>
            </View>
          </View>
        </View>

        {/* Informe Técnico Final */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORME TÉCNICO FINAL</Text>
          <Text style={styles.content}>{mainReport}</Text>
        </View>

        {/* Registro Técnico Original */}
        {hasOriginalReport && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REGISTRO TÉCNICO ORIGINAL</Text>
            <Text style={styles.content}>{record.technical_report}</Text>
          </View>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CHECKLIST DE MANTENIMIENTO</Text>
            <View style={styles.checklistItem}>
              <Text style={[styles.checklistName, { fontWeight: 'bold' }]}>ÍTEM</Text>
              <Text style={[styles.checklistStatus, { fontWeight: 'bold' }]}>RESULTADO</Text>
              <Text style={[styles.checklistNotes, { fontWeight: 'bold' }]}>NOTA</Text>
            </View>
            {checklist.map((item, index) => (
              <View key={index} style={styles.checklistItem}>
                <Text style={styles.checklistName}>{item.item_name}</Text>
                <Text style={styles.checklistStatus}>{CHECKLIST_STATUS[item.status] || item.status}</Text>
                <Text style={styles.checklistNotes}>{item.notes || '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>ESTADO DEL INFORME: APROBADO</Text>
          {record.approved_at && <Text>FECHA DE APROBACIÓN: {formatDate(record.approved_at)}</Text>}
          {approvedBy?.full_name && <Text>APROBADO POR: {approvedBy.full_name}</Text>}
          <Text style={{ marginTop: 10 }}>Documento generado por el Sistema QR de Trazabilidad y Mantenimiento de Ascensores</Text>
          <Text style={styles.footerWebsite}>{COMPANY_NAME} - {COMPANY_WEBSITE}</Text>
        </View>
      </Page>
    </Document>
  );
}
