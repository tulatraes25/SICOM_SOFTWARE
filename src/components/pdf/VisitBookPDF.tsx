import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ElevatorVisitEntry } from '@/types/database';
import { VISIT_ENTRY_TYPE_LABELS } from '@/types/database';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#8DB600', paddingBottom: 10, marginBottom: 15 },
  headerLeft: { flex: 1 },
  companyName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  title: { fontSize: 12, fontWeight: 'bold', color: '#06172E', marginTop: 8, marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, fontSize: 8, color: '#444' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#8DB600', paddingBottom: 4, marginBottom: 4 },
  tableHeaderText: { fontSize: 8, fontWeight: 'bold', color: '#06172E' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingBottom: 4, marginBottom: 4 },
  colEntry: { width: '8%' },
  colDate: { width: '14%' },
  colType: { width: '18%' },
  colCase: { width: '12%' },
  colTech: { width: '18%' },
  colDesc: { width: '30%' },
  colStatus: { width: '10%' },
  cellText: { fontSize: 8, color: '#333' },
  footer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#8DB600', fontSize: 7, color: '#999', textAlign: 'center' },
});

interface VisitBookPDFProps {
  elevatorCode: string;
  buildingName: string;
  clientName: string;
  dateFrom: string;
  dateTo: string;
  entries: ElevatorVisitEntry[];
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
        </View>
        <View style={styles.infoRow}>
          <Text>Período: {formatDate(dateFrom)} — {formatDate(dateTo)}</Text>
          <Text>Total de asientos: {entries.length}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colEntry]}>N.º</Text>
          <Text style={[styles.tableHeaderText, styles.colDate]}>Fecha</Text>
          <Text style={[styles.tableHeaderText, styles.colType]}>Tipo</Text>
          <Text style={[styles.tableHeaderText, styles.colCase]}>Expediente</Text>
          <Text style={[styles.tableHeaderText, styles.colTech]}>Técnico</Text>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>Descripción</Text>
          <Text style={[styles.tableHeaderText, styles.colStatus]}>Estado</Text>
        </View>

        {entries.map((entry) => (
          <View key={entry.id} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.colEntry]}>{entry.entry_number}</Text>
            <Text style={[styles.cellText, styles.colDate]}>{formatDate(entry.visit_date)}</Text>
            <Text style={[styles.cellText, styles.colType]}>{VISIT_ENTRY_TYPE_LABELS[entry.entry_type]}</Text>
            <Text style={[styles.cellText, styles.colCase]}>
              {entry.service_case ? `N.º ${(entry.service_case as any).case_number}` : '-'}
            </Text>
            <Text style={[styles.cellText, styles.colTech]}>
              {(entry.technician as any)?.full_name || '-'}
            </Text>
            <Text style={[styles.cellText, styles.colDesc]}>
              {entry.title || entry.description}
            </Text>
            <Text style={[styles.cellText, styles.colStatus]}>{entry.status}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          SICOM Patagonia SRL — Libro Digital de Visitas — Generado el {new Date().toLocaleDateString('es-AR')}
        </Text>
      </Page>
    </Document>
  );
}
