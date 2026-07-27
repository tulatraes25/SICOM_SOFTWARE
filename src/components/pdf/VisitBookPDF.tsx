import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ElevatorVisitEntry } from '@/types/database';
import { VISIT_ENTRY_STATUS_LABELS, VISIT_ORIGIN_LABELS } from '@/types/database';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 8, lineHeight: 1.3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#8DB600', paddingBottom: 10, marginBottom: 15 },
  headerLeft: { flex: 1 },
  companyName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  title: { fontSize: 11, fontWeight: 'bold', color: '#06172E', marginTop: 8, marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, fontSize: 8, color: '#444' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#8DB600', paddingBottom: 3, marginBottom: 3 },
  tableHeaderText: { fontSize: 7, fontWeight: 'bold', color: '#06172E' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingBottom: 3, marginBottom: 3 },
  colN: { width: '5%' },
  colDate: { width: '10%' },
  colOrigin: { width: '12%' },
  colDoc: { width: '15%' },
  colTech: { width: '13%' },
  colDesc: { width: '20%' },
  colIn: { width: '8%' },
  colOut: { width: '8%' },
  colDur: { width: '7%' },
  colStatus: { width: '8%' },
  cellText: { fontSize: 7, color: '#333' },
  footer: { marginTop: 15, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#8DB600', fontSize: 7, color: '#999', textAlign: 'center' },
});

interface VisitBookPDFProps {
  elevatorCode: string;
  buildingName: string;
  clientName: string;
  dateFrom: string;
  dateTo: string;
  entries: ElevatorVisitEntry[];
}

function formatCaseNumber(sc: any): string {
  if (!sc) return '';
  if (sc.numbering_mode === 'test') return `PRUEBA N.º ${sc.case_number}`;
  return `N.º ${sc.case_number}`;
}

export default function VisitBookPDF({
  elevatorCode,
  buildingName,
  clientName,
  dateFrom,
  dateTo,
  entries,
}: VisitBookPDFProps) {
  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${parseInt(day)}/${parseInt(m)}/${y}`;
  };

  const formatTime = (ts: string | null | undefined) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDuration = (mins: number | null | undefined, checkIn?: string | null, checkOut?: string | null) => {
    if (mins === null || mins === undefined) {
      if (checkIn && checkOut) {
        const diff = Math.floor((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
        if (diff === 0) return '<1 min';
        if (diff < 60) return `${diff} min`;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return m > 0 ? `${h} h ${m} min` : `${h} h`;
      }
      return '-';
    }
    if (mins === 0) return '<1 min';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  };

  return (
    <Document>
      <Page size={[842, 595]} style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>SICOM Patagonia SRL</Text>
            <Text style={{ fontSize: 7, color: '#666', marginTop: 2 }}>Libro Digital de Visitas</Text>
          </View>
        </View>

        <Text style={styles.title}>LIBRO DE VISITAS — {elevatorCode}</Text>

        <View style={styles.infoRow}>
          <Text>Edificio: {buildingName}</Text>
          <Text>Cliente: {clientName}</Text>
          <Text>Período: {formatDate(dateFrom)} — {formatDate(dateTo)}</Text>
          <Text>Total: {entries.length} asiento(s)</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colN]}>N.º</Text>
          <Text style={[styles.tableHeaderText, styles.colDate]}>Fecha</Text>
          <Text style={[styles.tableHeaderText, styles.colOrigin]}>Origen</Text>
          <Text style={[styles.tableHeaderText, styles.colDoc]}>Documento</Text>
          <Text style={[styles.tableHeaderText, styles.colTech]}>Técnico</Text>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>Descripción</Text>
          <Text style={[styles.tableHeaderText, styles.colIn]}>Ingreso</Text>
          <Text style={[styles.tableHeaderText, styles.colOut]}>Salida</Text>
          <Text style={[styles.tableHeaderText, styles.colDur]}>Duración</Text>
          <Text style={[styles.tableHeaderText, styles.colStatus]}>Estado</Text>
        </View>

        {entries.map((entry) => (
          <View key={entry.id} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.colN]}>{entry.entry_number}</Text>
            <Text style={[styles.cellText, styles.colDate]}>{formatDate(entry.visit_date)}</Text>
            <Text style={[styles.cellText, styles.colOrigin]}>{(VISIT_ORIGIN_LABELS as Record<string, string>)[entry.origin_type || ''] || entry.origin_type || '-'}</Text>
            <Text style={[styles.cellText, styles.colDoc]}>
              {entry.service_case
                ? formatCaseNumber(entry.service_case)
                : entry.service_order_id
                  ? 'Orden'
                  : entry.service_record_id
                    ? 'Mant.'
                    : '-'}
            </Text>
            <Text style={[styles.cellText, styles.colTech]}>
              {(entry.technician as any)?.full_name || '-'}
            </Text>
            <Text style={[styles.cellText, styles.colDesc]}>
              {entry.title || entry.description?.slice(0, 40) || '-'}
            </Text>
            <Text style={[styles.cellText, styles.colIn]}>{formatTime(entry.check_in_at)}</Text>
            <Text style={[styles.cellText, styles.colOut]}>{formatTime(entry.check_out_at)}</Text>
            <Text style={[styles.cellText, styles.colDur]}>{formatDuration(entry.duration_minutes, entry.check_in_at, entry.check_out_at)}</Text>
            <Text style={[styles.cellText, styles.colStatus]}>{(VISIT_ENTRY_STATUS_LABELS as Record<string, string>)[entry.status] || entry.status}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          SICOM Patagonia SRL — Libro Digital de Visitas — Generado el {new Date().toLocaleDateString('es-AR')}
        </Text>
      </Page>
    </Document>
  );
}
