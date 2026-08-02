import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { VISIT_ENTRY_STATUS_LABELS, VISIT_ORIGIN_LABELS } from '@/types/database';
import logoSicom from '@/assets/logo-sicom.png';
import { formatVisitDuration } from '@/utils/visitDuration';

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 7, lineHeight: 1.2 },
  header: { marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 50, height: 50 },
  headerRight: { alignItems: 'flex-end' },
  headerText: { fontSize: 7, color: '#555' },
  greenLine: { borderBottomWidth: 2, borderBottomColor: '#8DB600', marginTop: 5 },
  title: { fontSize: 10, fontWeight: 'bold', color: '#06172E', marginTop: 8, marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, fontSize: 7, color: '#444' },
  infoRow2: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, fontSize: 7, color: '#444' },
  testBanner: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 3, padding: 4, marginBottom: 8 },
  testText: { fontSize: 7, fontWeight: 'bold', color: '#92400e', textAlign: 'center' },
  elevatorSummary: { fontSize: 6, color: '#555', marginBottom: 6 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#8DB600', paddingBottom: 2, marginBottom: 2 },
  th: { fontSize: 6, fontWeight: 'bold', color: '#06172E' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingBottom: 2, marginBottom: 2 },
  td: { fontSize: 6, color: '#333' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, borderTopWidth: 1, borderTopColor: '#8DB600', paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6, color: '#999' },
});

const COL_ELEVATOR = {
  n: '4%', date: '7%', origin: '9%', doc: '14%', tech: '11%',
  summary: '27%', in: '6%', out: '6%', dur: '7%', status: '9%',
};

const COL_BUILDING = {
  elev: '8%', n: '4%', date: '7%', origin: '8%', doc: '13%', tech: '10%',
  summary: '24%', in: '6%', out: '6%', dur: '6%', status: '8%',
};

export interface VisitBookEntryData {
  id: string;
  entry_number: number;
  visit_date: string;
  origin_type?: string;
  title?: string;
  description: string;
  work_performed?: string;
  observations?: string;
  status: string;
  check_in_at?: string;
  check_out_at?: string;
  duration_minutes?: number;
  duration_seconds?: number;
  service_order_id?: string;
  service_record_id?: string;
  elevator?: { id: string; code: string };
  technician?: { id?: string; full_name?: string };
  service_case?: { id?: string; case_number?: number | null; numbering_mode?: string | null };
  _serviceRecord?: ServiceRecordData | null;
  _serviceOrder?: ServiceOrderData | null;
}

interface ServiceRecordData {
  description?: string | null;
  observations?: string | null;
  final_report_text?: string | null;
  technical_report?: string | null;
  service_type?: string | null;
  service_date?: string | null;
}

interface ServiceOrderData {
  completion_summary?: string | null;
}

export interface VisitBookPDFProps {
  scope: 'elevator' | 'building';
  elevatorCode?: string;
  buildingName: string;
  clientName: string;
  dateFrom: string;
  dateTo: string;
  entries: VisitBookEntryData[];
  elevatorCount?: number;
}

function formatCaseNumber(sc: { numbering_mode?: string | null; case_number?: number | null } | undefined): string {
  if (!sc) return '';
  if (sc.numbering_mode === 'test') return `PRUEBA N.º ${sc.case_number}`;
  return `N.º ${sc.case_number}`;
}

function formatDateShort(d: string): string {
  const [y, m, day] = d.split('-');
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
}

function formatTime(ts: string | null | undefined): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDuration(entry: { duration_seconds?: number; duration_minutes?: number; check_in_at?: string; check_out_at?: string }): string {
  return formatVisitDuration(entry);
}

function buildVisitBookSummary(entry: VisitBookEntryData): string {
  const MAX = 280;
  if (entry.origin_type === 'maintenance') {
    const sr = entry._serviceRecord;
    if (sr) {
      const texts = [sr.description, sr.observations, sr.final_report_text, sr.technical_report].filter((x): x is string => Boolean(x));
      for (const t of texts) {
        const clean = t.replace(/TAREAS REALIZADAS[\s\S]*/i, '').replace(/CONCLUSIÓN[\s\S]*/i, '').trim();
        if (clean.length > 10) return clean.length > MAX ? clean.slice(0, MAX) + '…' : clean;
      }
    }
    return entry.work_performed && entry.work_performed !== 'Trabajo completado'
      ? (entry.work_performed.length > MAX ? entry.work_performed.slice(0, MAX) + '…' : entry.work_performed)
      : 'Mantenimiento realizado sin observaciones adicionales.';
  }
  if (entry.origin_type === 'service_order') {
    const so = entry._serviceOrder as Record<string, unknown> | null | undefined;
    const summary = so?.completion_summary;
    if (typeof summary === 'string' && summary !== 'Trabajo completado') {
      return summary.length > MAX ? summary.slice(0, MAX) + '…' : summary;
    }
    if (entry.work_performed && entry.work_performed !== 'Trabajo completado') {
      return entry.work_performed.length > MAX ? entry.work_performed.slice(0, MAX) + '…' : entry.work_performed;
    }
  }
  const fallback = entry.title || entry.description || '-';
  return fallback.length > MAX ? fallback.slice(0, MAX) + '…' : fallback;
}

function buildDocumentLabel(entry: VisitBookEntryData): string {
  if (entry.service_case) return formatCaseNumber(entry.service_case);
  if (entry.service_order_id) return 'Orden de servicio';
  if (entry.service_record_id) {
    const sr = entry._serviceRecord;
    const type = sr?.service_type === 'preventivo' ? 'Mantenimiento preventivo'
      : sr?.service_type === 'correctivo' ? 'Mantenimiento correctivo'
      : sr?.service_type === 'emergencia' ? 'Mantenimiento de emergencia'
      : sr?.service_type === 'inspeccion' ? 'Inspección'
      : sr?.service_type === 'instalacion' ? 'Instalación'
      : 'Mantenimiento';
    const date = sr?.service_date ? formatDateShort(sr.service_date) : '';
    return date ? `${type} - ${date}` : type;
  }
  return '-';
}

export function formatEntryCount(count: number): string {
  return count === 1 ? '1 asiento' : `${count} asientos`;
}

export default function VisitBookPDF({
  scope, elevatorCode, buildingName, clientName, dateFrom, dateTo, entries, elevatorCount,
}: VisitBookPDFProps) {
  const hasTestEntries = entries.some((e) =>
    e.service_case?.numbering_mode === 'test' ||
    (e.service_case?.case_number !== null && e.service_case?.case_number !== undefined && e.service_case.case_number >= 1900 && e.service_case.case_number <= 1999)
  );

  // Building scope: group by elevator for summary
  const elevatorSummary = scope === 'building' ? (() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      const code = e.elevator?.code || 'Sin ascensor';
      map.set(code, (map.get(code) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })() : null;

  const col: Record<string, string> = scope === 'building' ? COL_BUILDING : COL_ELEVATOR;

  const renderHeader = () => (
    <View style={styles.header} fixed>
      <View style={styles.headerRow}>
        <Image src={logoSicom} style={styles.logo} />
        <View style={styles.headerRight}>
          <Text style={styles.headerText}>+54 297 421-4430</Text>
          <Text style={styles.headerText}>sicompatagonia.com</Text>
        </View>
      </View>
      <View style={styles.greenLine} />
      <Text style={styles.title}>
        {scope === 'building' ? 'LIBRO DIGITAL DE VISITAS DEL EDIFICIO' : `LIBRO DE VISITAS — ${elevatorCode}`}
      </Text>
      <View style={styles.infoRow}>
        <Text>Edificio: {buildingName}</Text>
        <Text>Cliente: {clientName}</Text>
        <Text>Período: {formatDateShort(dateFrom)} — {formatDateShort(dateTo)}</Text>
      </View>
      <View style={styles.infoRow2}>
        {scope === 'building' && <Text>Ascensores incluidos: {elevatorCount || elevatorSummary?.length || 0}</Text>}
        <Text>Total: {formatEntryCount(entries.length)}</Text>
      </View>
      {hasTestEntries && (
        <View style={styles.testBanner}>
          <Text style={styles.testText}>DOCUMENTO DE PRUEBA — SIN VALIDEZ COMERCIAL</Text>
        </View>
      )}
      {elevatorSummary && elevatorSummary.length > 0 && (
        <View style={styles.elevatorSummary}>
          <Text>Equipos incluidos: {elevatorSummary.map(([code, count]) => `${code} — ${formatEntryCount(count)}`).join(' | ')}</Text>
        </View>
      )}
      <View style={styles.tableHeader}>
        {scope === 'building' && <Text style={[styles.th, { width: col.elev }]}>Ascensor</Text>}
        <Text style={[styles.th, { width: col.n }]}>N.º</Text>
        <Text style={[styles.th, { width: col.date }]}>Fecha</Text>
        <Text style={[styles.th, { width: col.origin }]}>Origen</Text>
        <Text style={[styles.th, { width: col.doc }]}>Documento</Text>
        <Text style={[styles.th, { width: col.tech }]}>Técnico</Text>
        <Text style={[styles.th, { width: col.summary }]}>Resumen</Text>
        <Text style={[styles.th, { width: col.in }]}>Ingreso</Text>
        <Text style={[styles.th, { width: col.out }]}>Salida</Text>
        <Text style={[styles.th, { width: col.dur }]}>Duración</Text>
        <Text style={[styles.th, { width: col.status }]}>Estado</Text>
      </View>
    </View>
  );

  return (
    <Document>
      <Page size={[842, 595]} style={styles.page}>
        {renderHeader()}
        {entries.map((entry) => (
          <View key={entry.id} style={styles.tableRow} wrap={false}>
            {scope === 'building' && <Text style={[styles.td, { width: col.elev }]}>{entry.elevator?.code || '-'}</Text>}
            <Text style={[styles.td, { width: col.n }]}>{entry.entry_number}</Text>
            <Text style={[styles.td, { width: col.date }]}>{formatDateShort(entry.visit_date)}</Text>
            <Text style={[styles.td, { width: col.origin }]}>{(VISIT_ORIGIN_LABELS as Record<string, string>)[entry.origin_type || ''] || '-'}</Text>
            <Text style={[styles.td, { width: col.doc }]}>{buildDocumentLabel(entry)}</Text>
            <Text style={[styles.td, { width: col.tech }]}>{entry.technician?.full_name || '-'}</Text>
            <Text style={[styles.td, { width: col.summary }]}>{buildVisitBookSummary(entry)}</Text>
            <Text style={[styles.td, { width: col.in }]}>{formatTime(entry.check_in_at)}</Text>
            <Text style={[styles.td, { width: col.out }]}>{formatTime(entry.check_out_at)}</Text>
            <Text style={[styles.td, { width: col.dur }]}>{formatDuration(entry)}</Text>
            <Text style={[styles.td, { width: col.status }]}>{(VISIT_ENTRY_STATUS_LABELS as Record<string, string>)[entry.status] || '-'}</Text>
          </View>
        ))}
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) =>
          `SICOM Patagonia SRL | +54 297 421-4430 | sicompatagonia.com | Página ${pageNumber} de ${totalPages} | Generado el ${new Date().toLocaleDateString('es-AR')}`
        } />
      </Page>
    </Document>
  );
}
