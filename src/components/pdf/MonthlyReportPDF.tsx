import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoSicom from '@/assets/logo-sicom.png';

const C = { navy: '#06172E', green: '#8DB600', white: '#FFFFFF', gray50: '#F9FAFB', gray100: '#F3F4F6', gray200: '#E5E7EB', gray400: '#9CA3AF', gray600: '#4B5563', gray800: '#1F2937' };
const fmtDate = (d: string) => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${parseInt(day)}/${parseInt(m)}/${y}`; };
const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const s = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', fontSize: 9, color: C.gray800, paddingBottom: 60 },

  // Header
  header: { paddingHorizontal: 35, paddingTop: 20, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 110, height: 83 },
  headerRight: { alignItems: 'flex-end', gap: 1, paddingTop: 5 },
  headerText: { fontSize: 7, color: C.gray600 },
  greenLine: { height: 2, backgroundColor: C.green, marginTop: 8 },

  // Title banner
  titleBanner: { backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleText: { fontSize: 14, fontWeight: 'bold', color: C.white, letterSpacing: 2 },
  titlePeriod: { fontSize: 9, color: C.white, opacity: 0.9 },
  testBanner: { backgroundColor: '#FEF3C7', paddingHorizontal: 35, paddingVertical: 5 },
  testText: { fontSize: 7, fontWeight: 'bold', color: '#92400E', textAlign: 'center', letterSpacing: 1 },

  // Content
  content: { paddingHorizontal: 35, paddingTop: 12 },

  // Cover info
  coverInfo: { backgroundColor: C.gray50, borderRadius: 4, borderWidth: 0.5, borderColor: C.gray200, padding: 10, marginBottom: 12 },
  coverRow: { flexDirection: 'row', marginBottom: 3 },
  coverLabel: { fontSize: 7, color: C.gray400, width: '25%', textTransform: 'uppercase' },
  coverValue: { fontSize: 8.5, color: C.gray800, flex: 1 },

  // Summary
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  summaryCard: { width: '30%', backgroundColor: C.gray50, borderRadius: 3, borderWidth: 0.5, borderColor: C.gray200, padding: 6, alignItems: 'center' },
  summaryNum: { fontSize: 16, fontWeight: 'bold', color: C.navy },
  summaryLabel: { fontSize: 6.5, color: C.gray400, textTransform: 'uppercase' },

  // Sections
  section: { marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 9, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.gray200 },
  introText: { fontSize: 8, color: C.gray600, lineHeight: 1.5, marginBottom: 8, fontStyle: 'italic' },

  // Entry cards
  entryCard: { backgroundColor: C.gray50, borderRadius: 3, borderWidth: 0.5, borderColor: C.gray200, padding: 8, marginBottom: 6 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  entryType: { fontSize: 7.5, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase' },
  entryDate: { fontSize: 7, color: C.gray400 },
  entryField: { flexDirection: 'row', marginBottom: 2 },
  entryLabel: { fontSize: 6.5, color: C.gray400, width: '22%' },
  entryValue: { fontSize: 7.5, color: C.gray800, flex: 1 },

  // Status badge in entry
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  statusApproved: { backgroundColor: '#D1FAE5', color: '#065F46' },

  // Conclusion
  conclusion: { backgroundColor: C.gray50, borderRadius: 3, borderWidth: 0.5, borderColor: C.gray200, padding: 10, marginTop: 8 },
  conclusionTitle: { fontSize: 8, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 4 },
  conclusionText: { fontSize: 8, color: C.gray800, lineHeight: 1.5 },

  // Signature
  sigRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingRight: 10 },
  sigBlock: { width: 180, alignItems: 'center' },
  sigImg: { width: 120, height: 40, objectFit: 'contain', marginBottom: 2 },
  sigLine: { width: 150, borderBottomWidth: 0.8, borderColor: C.gray400, marginBottom: 3 },
  sigName: { fontSize: 7.5, fontWeight: 'bold', color: C.gray800 },
  sigRole: { fontSize: 6.5, color: C.gray600 },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 6.5, color: C.white, opacity: 0.8 },
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
  const buildingAddress = report.elevator?.building?.address || '';
  const clientName = report.elevator?.building?.client?.name || '';
  const periodLabel = `${MONTH_NAMES[report.report_month || 0]} ${report.report_year || ''}`;
  const today = new Date().toLocaleDateString('es-AR');
  const generalStatusLabel: Record<string, string> = {
    operativo: 'Operativo', operativo_con_observaciones: 'Operativo con observaciones',
    requiere_seguimiento: 'Requiere seguimiento', fuera_de_servicio: 'Fuera de servicio',
  };

  const getConclusion = () => {
    const status = report.general_status || 'operativo';
    const base = `Conforme a las intervenciones registradas y aprobadas durante ${periodLabel}, el ascensor ${elevatorCode}`;
    switch (status) {
      case 'operativo': return `${base} se encuentra operativo, sin perjuicio de las observaciones particulares consignadas en el presente informe.`;
      case 'operativo_con_observaciones': return `${base} se encuentra operativo con las observaciones detalladas en el presente informe.`;
      case 'requiere_seguimiento': return `${base} requiere seguimiento técnico according a las observaciones registradas.`;
      case 'fuera_de_servicio': return `${base} se encuentra fuera de servicio según el diagnóstico registrado.`;
      default: return `${base} se encuentra en evaluación according al estado registrado.`;
    }
  };

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* HEADER */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <Image src={logoSicom} style={s.logo} />
            <View style={s.headerRight}>
              <Text style={s.headerText}>+54 297 421-4430</Text>
              <Text style={s.headerText}>sicompatagonia.com</Text>
            </View>
          </View>
          <View style={s.greenLine} />
        </View>

        {/* TITLE */}
        <View style={s.titleBanner}>
          <Text style={s.titleText}>INFORME TÉCNICO MENSUAL</Text>
          <Text style={s.titlePeriod}>{periodLabel} — {elevatorCode}</Text>
        </View>
        {report.numbering_mode === 'test' && (
          <View style={s.testBanner}><Text style={s.testText}>DOCUMENTO DE PRUEBA — SIN VALIDEZ COMERCIAL</Text></View>
        )}

        <View style={s.content}>

          {/* Cover info */}
          <View style={s.coverInfo}>
            <View style={s.coverRow}><Text style={s.coverLabel}>Cliente</Text><Text style={s.coverValue}>{clientName}</Text></View>
            <View style={s.coverRow}><Text style={s.coverLabel}>Edificio</Text><Text style={s.coverValue}>{buildingName}</Text></View>
            {buildingAddress && <View style={s.coverRow}><Text style={s.coverLabel}>Dirección</Text><Text style={s.coverValue}>{buildingAddress}</Text></View>}
            <View style={s.coverRow}><Text style={s.coverLabel}>Ascensor</Text><Text style={s.coverValue}>{elevatorCode}</Text></View>
            <View style={s.coverRow}><Text style={s.coverLabel}>Período</Text><Text style={s.coverValue}>{periodLabel}</Text></View>
            <View style={s.coverRow}><Text style={s.coverLabel}>Estado</Text><Text style={s.coverValue}>{generalStatusLabel[report.general_status || 'operativo'] || report.general_status || 'No informado'}</Text></View>
            <View style={s.coverRow}><Text style={s.coverLabel}>Emisión</Text><Text style={s.coverValue}>{today}</Text></View>
          </View>

          {/* Summary */}
          <View style={s.summaryGrid}>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.preventiveCount}</Text><Text style={s.summaryLabel}>Preventivos</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.correctiveCount}</Text><Text style={s.summaryLabel}>Correctivos</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.serviceOrderCount}</Text><Text style={s.summaryLabel}>Órdenes</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.claimCount}</Text><Text style={s.summaryLabel}>Reclamos</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.totalApproved}</Text><Text style={s.summaryLabel}>Aprobados</Text></View>
            <View style={s.summaryCard}><Text style={s.summaryNum}>{summary.totalWithCorrections}</Text><Text style={s.summaryLabel}>Correcciones</Text></View>
          </View>

          <Text style={s.introText}>Durante el período informado se realizaron las intervenciones detalladas a continuación, conforme a los registros técnicos aprobados en el sistema.</Text>

          {/* Maintenances */}
          {maintenances.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Mantenimientos Realizados ({maintenances.length})</Text>
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
              <Text style={s.sectionTitle}>Reclamos del Período ({claims.length})</Text>
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

          {/* Conclusion */}
          <View style={s.conclusion}>
            <Text style={s.conclusionTitle}>Conclusión del Período</Text>
            <Text style={s.conclusionText}>{getConclusion()}</Text>
            {report.general_notes && <Text style={[s.conclusionText, { marginTop: 4 }]}>{report.general_notes}</Text>}
          </View>

          {/* Signature */}
          <View style={s.sigRow}>
            <View style={s.sigBlock}>
              {signatureUrl ? <Image src={signatureUrl} style={s.sigImg} /> : <View style={s.sigLine} />}
              <Text style={s.sigName}>{signerName || 'Administrador'}</Text>
              <Text style={s.sigRole}>SICOM Patagonia SRL</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SICOM Patagonia SRL — Informe Mensual {periodLabel}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
