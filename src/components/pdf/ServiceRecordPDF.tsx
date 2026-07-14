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
    status: string;
    approved_at?: string;
  };
  elevator: {
    code: string;
    manufacturer?: string;
    model?: string;
    elevator_type?: string;
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
  selectedPhotos?: Array<{ id: string; signedUrl?: string; photo_type?: string; report_order?: number }>;
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#8DB600', paddingBottom: 12, marginBottom: 15 },
  logo: { width: 100, height: 40 },
  headerRight: { alignItems: 'flex-end', flex: 1, marginLeft: 15 },
  companyName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  companySlogan: { fontSize: 7, color: '#666', marginTop: 2 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#8DB600', textAlign: 'center', marginBottom: 10 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#06172E', borderBottomWidth: 1, borderBottomColor: '#8DB600', paddingBottom: 4, marginBottom: 8 },
  dataGrid: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 15 },
  dataItem: { width: '50%', marginBottom: 6 },
  label: { fontSize: 8, color: '#666', textTransform: 'uppercase' },
  value: { fontSize: 10, fontWeight: 'bold' },
  content: { fontSize: 10, lineHeight: 1.6 },
  checklistHeader: { flexDirection: 'row', backgroundColor: '#06172E', padding: 6, borderRadius: 4 },
  checklistHeaderText: { color: '#ffffff', fontSize: 8, fontWeight: 'bold' },
  checklistRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 4 },
  checklistItemName: { width: '45%', fontSize: 9 },
  checklistItemStatus: { width: '25%', fontSize: 9, fontWeight: 'bold' },
  checklistItemNotes: { width: '30%', fontSize: 8, color: '#666' },
  photoSection: { marginTop: 20, marginBottom: 15 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoContainer: { width: '48%', marginBottom: 10 },
  photo: { width: '100%', height: 120, objectFit: 'contain', backgroundColor: '#f3f4f6', borderRadius: 4 },
  photoCaption: { fontSize: 8, color: '#666', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 9, fontWeight: 'bold' },
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

export default function ServiceRecordPDF({
  record,
  elevator,
  approvedBy,
  checklist = [],
  selectedPhotos = [],
}: ServiceRecordPDFProps) {
  const building = elevator.building;
  const mainReport = getMainReportText(record);

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

        {/* Ficha técnica */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FICHA TÉCNICA</Text>
          <View style={styles.dataGrid}>
            <View style={styles.dataItem}><Text style={styles.label}>CLIENTE</Text><Text style={styles.value}>{building?.client?.name || 'N/D'}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>EDIFICIO</Text><Text style={styles.value}>{building?.name || 'N/D'}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>CÓDIGO</Text><Text style={styles.value}>{elevator.code}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>UBICACIÓN</Text><Text style={styles.value}>{building?.address || 'N/D'}, {building?.locality || 'N/D'}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>FABRICANTE</Text><Text style={styles.value}>{elevator.manufacturer?.trim() || 'N/D'}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>MODELO</Text><Text style={styles.value}>{elevator.model?.trim() || 'N/D'}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>TIPO</Text><Text style={styles.value}>{elevator.elevator_type || 'N/D'}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>FECHA</Text><Text style={styles.value}>{formatDate(record.service_date)}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>ESTADO OPERATIVO</Text><Text style={[styles.statusBadge, getStatusStyle(record.operational_status_at_service || '')]}>{getStatusLabel(record.operational_status_at_service || '')}</Text></View>
            <View style={styles.dataItem}><Text style={styles.label}>ESTADO CONSERVACIÓN</Text><Text style={[styles.statusBadge, getStatusStyle(record.conservation_status_at_service || '')]}>{getStatusLabel(record.conservation_status_at_service || '')}</Text></View>
          </View>
        </View>

        {/* Informe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORME TÉCNICO</Text>
          <Text style={styles.content}>{mainReport}</Text>
        </View>

        {/* Checklist */}
        {checklist.length > 0 && (
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
        )}

        {/* Registro fotográfico */}
        {selectedPhotos.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>REGISTRO FOTOGRÁFICO</Text>
            <View style={styles.photoGrid}>
              {selectedPhotos
                .sort((a, b) => (a.report_order || 0) - (b.report_order || 0))
                .map((photo, index) => (
                  <View key={photo.id} style={styles.photoContainer}>
                    {photo.signedUrl ? (
                      <Image src={photo.signedUrl} style={styles.photo} />
                    ) : (
                      <View style={[styles.photo, { justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 8, color: '#999' }}>No disponible</Text>
                      </View>
                    )}
                    <Text style={styles.photoCaption}>Fotografía {index + 1}</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={{ marginTop: 30, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#8DB600', fontSize: 8, color: '#666', textAlign: 'center' }}>
          <Text>Estado: APROBADO</Text>
          {record.approved_at && <Text>Fecha de aprobación: {formatDate(record.approved_at)}</Text>}
          {approvedBy?.full_name && <Text>Aprobado por: {approvedBy.full_name}</Text>}
          <Text style={{ marginTop: 10 }}>Documento generado por el Sistema QR de Trazabilidad y Mantenimiento de Ascensores</Text>
          <Text style={{ color: '#8DB600', marginTop: 5 }}>{COMPANY_NAME} - {COMPANY_WEBSITE}</Text>
        </View>
      </Page>
    </Document>
  );
}
