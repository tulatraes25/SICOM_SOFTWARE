import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_NAME, COMPANY_SLOGAN, COMPANY_WEBSITE } from '@/config/constants';

interface ServiceRecordPDFProps {
  record: {
    service_date: string;
    service_type: string;
    operational_status_at_service?: string;
    conservation_status_at_service?: string;
    description?: string;
    observations?: string;
    technical_report?: string;
    status: string;
    approved_at?: string;
  };
  elevator: {
    code: string;
    manufacturer?: string;
    model?: string;
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
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#8DB600', paddingBottom: 15, marginBottom: 20 },
  companyName: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  companySlogan: { fontSize: 7, color: '#666', marginTop: 2 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#8DB600', textAlign: 'center', marginBottom: 10 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#8DB600', paddingBottom: 4, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  col: { width: '50%', marginBottom: 6 },
  label: { fontSize: 8, color: '#666', textTransform: 'uppercase' },
  value: { fontSize: 10, fontWeight: 'bold' },
  content: { fontSize: 10, lineHeight: 1.6 },
  footer: { marginTop: 30, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#8DB600', fontSize: 8, color: '#666', textAlign: 'center' },
  footerWebsite: { color: '#8DB600', marginTop: 5 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 9, fontWeight: 'bold', alignSelf: 'flex-start' },
  checklistItem: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 4 },
  checklistName: { width: '50%', fontSize: 9 },
  checklistStatus: { width: '30%', fontSize: 9, fontWeight: 'bold' },
  checklistNotes: { width: '20%', fontSize: 8, color: '#666' },
});

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

export default function ServiceRecordPDF({
  record,
  elevator,
  technician,
  approvedBy,
  checklist = [],
}: ServiceRecordPDFProps) {
  const building = elevator.building;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>SICOM</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.companyName}>{COMPANY_NAME}</Text>
            <Text style={styles.companySlogan}>{COMPANY_SLOGAN}</Text>
          </View>
        </View>

        <Text style={styles.title}>INFORME TÉCNICO DE MANTENIMIENTO</Text>

        {/* Datos del equipo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Equipo</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Código</Text>
              <Text style={styles.value}>{elevator.code}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Edificio</Text>
              <Text style={styles.value}>{building?.name || 'N/D'}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Dirección</Text>
              <Text style={styles.value}>{building?.address || 'N/D'}, {building?.locality || 'N/D'}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Cliente</Text>
              <Text style={styles.value}>{building?.client?.name || 'N/D'}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Fabricante</Text>
              <Text style={styles.value}>{elevator.manufacturer || 'N/D'}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Modelo</Text>
              <Text style={styles.value}>{elevator.model || 'N/D'}</Text>
            </View>
          </View>
        </View>

        {/* Datos del servicio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Servicio</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Fecha</Text>
              <Text style={styles.value}>{new Date(record.service_date).toLocaleDateString('es-AR')}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Tipo</Text>
              <Text style={styles.value}>{record.service_type}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Técnico</Text>
              <Text style={styles.value}>{technician?.full_name || 'N/D'}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Estado Operativo</Text>
              <Text style={[styles.value, { color: STATUS_COLORS[record.operational_status_at_service || ''] || '#333' }]}>
                {STATUS_LABELS[record.operational_status_at_service || ''] || record.operational_status_at_service || 'N/D'}
              </Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Estado Conservación</Text>
              <Text style={[styles.value, { color: STATUS_COLORS[record.conservation_status_at_service || ''] || '#333' }]}>
                {STATUS_LABELS[record.conservation_status_at_service || ''] || record.conservation_status_at_service || 'N/D'}
              </Text>
            </View>
          </View>
        </View>

        {/* Descripción */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción del Trabajo</Text>
          <Text style={styles.content}>{record.description || 'No informado'}</Text>
        </View>

        {/* Observaciones */}
        {record.observations && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <Text style={styles.content}>{record.observations}</Text>
          </View>
        )}

        {/* Mini informe */}
        {record.technical_report && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informe Técnico</Text>
            <Text style={styles.content}>{record.technical_report}</Text>
          </View>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Checklist de Mantenimiento</Text>
            {checklist.map((item, index) => (
              <View key={index} style={styles.checklistItem}>
                <Text style={styles.checklistName}>{item.item_name}</Text>
                <Text style={styles.checklistStatus}>{CHECKLIST_STATUS[item.status] || item.status}</Text>
                <Text style={styles.checklistNotes}>{item.notes || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Estado del informe: APROBADO</Text>
          {record.approved_at && <Text>Fecha de aprobación: {new Date(record.approved_at).toLocaleDateString('es-AR')}</Text>}
          {approvedBy?.full_name && <Text>Aprobado por: {approvedBy.full_name}</Text>}
          <Text style={{ marginTop: 10 }}>Documento generado por el Sistema QR de Trazabilidad y Mantenimiento de Ascensores</Text>
          <Text style={styles.footerWebsite}>{COMPANY_NAME} - {COMPANY_WEBSITE}</Text>
        </View>
      </Page>
    </Document>
  );
}
