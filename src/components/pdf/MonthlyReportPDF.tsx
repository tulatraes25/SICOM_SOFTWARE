import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoSicom from '@/assets/logo-sicom.png';

const C = { navy: '#06172E', green: '#8DB600', white: '#FFFFFF', gray50: '#F9FAFB', gray200: '#E5E7EB', gray400: '#9CA3AF', gray600: '#4B5563', gray800: '#1F2937' };
const fmtDate = (d: string) => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${parseInt(day)}/${parseInt(m)}/${y}`; };

const s = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', fontSize: 9, color: C.gray800, paddingBottom: 60 },
  header: { paddingHorizontal: 35, paddingTop: 25, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 120, height: 91 },
  headerRight: { alignItems: 'flex-end', gap: 2, paddingTop: 5 },
  headerText: { fontSize: 7.5, color: C.gray600 },
  greenLine: { height: 3, backgroundColor: C.green, marginTop: 10 },
  titleBanner: { backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleText: { fontSize: 16, fontWeight: 'bold', color: C.white, letterSpacing: 3 },
  titlePeriod: { fontSize: 10, color: C.white, opacity: 0.9 },
  testBanner: { backgroundColor: '#FEF3C7', paddingHorizontal: 35, paddingVertical: 6 },
  testText: { fontSize: 8, fontWeight: 'bold', color: '#92400E', textAlign: 'center' },
  content: { paddingHorizontal: 35, paddingTop: 15 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  summaryCard: { width: '30%', backgroundColor: C.gray50, borderRadius: 4, borderWidth: 0.5, borderColor: C.gray200, padding: 8, alignItems: 'center' },
  summaryNum: { fontSize: 18, fontWeight: 'bold', color: C.navy },
  summaryLabel: { fontSize: 7, color: C.gray400, textTransform: 'uppercase' },
  section: { marginBottom: 14, marginTop: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.gray200 },
  entryCard: { backgroundColor: C.gray50, borderRadius: 4, borderWidth: 0.5, borderColor: C.gray200, padding: 10, marginBottom: 8 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  entryType: { fontSize: 8, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase' },
  entryDate: { fontSize: 7, color: C.gray400 },
  entryField: { flexDirection: 'row', marginBottom: 2 },
  entryLabel: { fontSize: 7, color: C.gray400, width: '25%' },
  entryValue: { fontSize: 8, color: C.gray800, flex: 1 },
  sigRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, paddingRight: 10 },
  sigBlock: { width: 200, alignItems: 'center' },
  sigImg: { width: 130, height: 45, objectFit: 'contain', marginBottom: 2 },
  sigLine: { width: 160, borderBottomWidth: 0.8, borderColor: C.gray400, marginBottom: 4 },
  sigName: { fontSize: 8, fontWeight: 'bold', color: C.gray800 },
  sigRole: { fontSize: 7, color: C.gray600 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.white, opacity: 0.8 },
});

interface MonthlyReportPDFProps {
  report: any;
  maintenances: any[];
  serviceOrders: any[];
  claims: any[];
  summary: any;
  signatureUrl?: string;
  signerName?: string;
}

export default function MonthlyReportPDF({ report, maintenances, serviceOrders, claims, summary, signatureUrl, signerName }: MonthlyReportPDFProps) {
  const elevatorCode = report.elevator?.code || 'N/D';
  const buildingName = report.elevator?.building?.name || '';
  const clientName = report.elevator?.building?.client?.name || '';
  const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const periodLabel = `${monthNames[report.report_month || 0]} ${report.report_year || ''}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <Image src={logoSicom} style={s.logo} />
            <View style={s.headerRight}><Text style={s.headerText}>+54 297 421-4430</Text><Text style={s.headerText}>sicompatagonia.com</Text></View>
          </View>
          <View style={s.greenLine} />
        </View>

        <View style={s.titleBanner}>
          <Text style={s.titleText}>INFORME MENSUAL</Text>
          <Text style={s.titlePeriod}>{periodLabel} — {elevatorCode}</Text>
        </View>

        <View style={s.content}>
          {/* Summary */}
          <View style={s.summaryGrid}>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.preventiveCount}</Text><Text style={s.summaryLabel}>Preventivos</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.correctiveCount}</Text><Text style={s.summaryLabel}>Correctivos</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.serviceOrderCount}</Text><Text style={s.summaryLabel}>Órdenes</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.claimCount}</Text><Text style={s.summaryLabel}>Reclamos</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.totalApproved}</Text><Text style={s.summaryLabel}>Aprobados</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.totalWithCorrections}</Text><Text style={s.summaryLabel}>Con correcciones</Text></View>
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 8, color: C.gray600 }}>
              Período: {periodLabel} | Cliente: {clientName} | Edificio: {buildingName} | Ascensor: {elevatorCode}
            </Text>
            {report.general_status && <Text style={{ fontSize: 8, color: C.navy, fontWeight: 'bold', marginTop: 4 }}>Estado general: {report.general_status}</Text>}
          </View>

          {/* Maintenances */}
          {maintenances.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Mantenimientos ({maintenances.length})</Text>
              {maintenances.map((m: any, i: number) => (
                <View key={i} style={s.entryCard}>
                  <View style={s.entryHeader}>
                    <Text style={s.entryType}>{m.service_type}</Text>
                    <Text style={s.entryDate}>{fmtDate(m.service_date)}</Text>
                  </View>
                  <View style={s.entryField}><Text style={s.entryLabel}>Técnico</Text><Text style={s.entryValue}>{m.technician?.full_name || 'N/D'}</Text></View>
                  <View style={s.entryField}><Text style={s.entryLabel}>Resultado</Text><Text style={s.entryValue}>{m.status}</Text></View>
                </View>
              ))}
            </View>
          )}

          {/* Service Orders */}
          {serviceOrders.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Órdenes de Servicio ({serviceOrders.length})</Text>
              {serviceOrders.map((o: any, i: number) => (
                <View key={i} style={s.entryCard}>
                  <View style={s.entryHeader}>
                    <Text style={s.entryType}>ORDEN DE SERVICIO</Text>
                    <Text style={s.entryDate}>{fmtDate(o.order_date)}</Text>
                  </View>
                  <View style={s.entryField}><Text style={s.entryLabel}>Trabajo</Text><Text style={s.entryValue}>{o.work_requested || 'N/D'}</Text></View>
                  <View style={s.entryField}><Text style={s.entryLabel}>Resultado</Text><Text style={s.entryValue}>{o.status}</Text></View>
                </View>
              ))}
            </View>
          )}

          {/* Claims */}
          {claims.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Reclamos ({claims.length})</Text>
              {claims.map((cl: any, i: number) => (
                <View key={i} style={s.entryCard}>
                  <View style={s.entryHeader}>
                    <Text style={s.entryType}>RECLAMO</Text>
                    <Text style={s.entryDate}>{fmtDate(cl.claim_date)}</Text>
                  </View>
                  <View style={s.entryField}><Text style={s.entryLabel}>Asunto</Text><Text style={s.entryValue}>{cl.subject || 'N/D'}</Text></View>
                  <View style={s.entryField}><Text style={s.entryLabel}>Estado</Text><Text style={s.entryValue}>{cl.status}</Text></View>
                </View>
              ))}
            </View>
          )}

          {/* Signature */}
          <View style={s.sigRow}>
            <View style={s.sigBlock}>
              {signatureUrl ? <Image src={signatureUrl} style={s.sigImg} /> : <View style={s.sigLine} />}
              <Text style={s.sigName}>{signerName || 'Administrador'}</Text>
              <Text style={s.sigRole}>SICOM Patagonia SRL</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>SICOM Patagonia SRL — Informe Mensual {periodLabel}</Text>
          <Text style={s.footerText}>Página 1</Text>
        </View>
      </Page>
    </Document>
  );
}
