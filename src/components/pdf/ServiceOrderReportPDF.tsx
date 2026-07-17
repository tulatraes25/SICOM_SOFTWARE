import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoSicom from '@/assets/logo-sicom.png';
import { SERVICE_ORDER_TYPE_LABELS, CLAIM_PRIORITY_LABELS } from '@/types/database';

const C = { navy: '#06172E', green: '#8DB600', white: '#FFFFFF', gray50: '#F9FAFB', gray200: '#E5E7EB', gray400: '#9CA3AF', gray600: '#4B5563', gray800: '#1F2937' };
const fmtDate = (d: string) => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${parseInt(day)}/${parseInt(m)}/${y}`; };
const fmtDateTime = (d: string) => { if (!d) return '-'; return new Date(d).toLocaleString('es-AR'); };

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
  titleNumber: { fontSize: 10, color: C.white, opacity: 0.9 },
  testBanner: { backgroundColor: '#FEF3C7', paddingHorizontal: 35, paddingVertical: 6 },
  testText: { fontSize: 8, fontWeight: 'bold', color: '#92400E', textAlign: 'center', letterSpacing: 1 },
  content: { paddingHorizontal: 35, paddingTop: 15 },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  infoCard: { flex: 1, backgroundColor: C.gray50, borderRadius: 4, borderWidth: 0.5, borderColor: C.gray200, padding: 10 },
  cardTitle: { fontSize: 8, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 6 },
  field: { marginBottom: 4 },
  label: { fontSize: 6.5, fontWeight: 'bold', color: C.gray400, textTransform: 'uppercase' },
  value: { fontSize: 9, color: C.gray800 },
  section: { marginBottom: 16, marginTop: 14 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.gray200 },
  desc: { fontSize: 9, color: C.gray800, lineHeight: 1.6 },
  tableHeader: { flexDirection: 'row', backgroundColor: C.navy, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 3, marginBottom: 4 },
  thText: { fontSize: 7, fontWeight: 'bold', color: C.white, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderColor: C.gray200 },
  tableRowAlt: { backgroundColor: C.gray50 },
  td: { fontSize: 8, color: C.gray800 },
  eventRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  eventDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginTop: 4 },
  eventText: { flex: 1 },
  eventTitle: { fontSize: 8.5, color: C.gray800 },
  eventMeta: { fontSize: 7, color: C.gray400, marginTop: 1 },
  sigRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, paddingRight: 10 },
  sigBlock: { width: 200, alignItems: 'center' },
  sigImg: { width: 130, height: 45, objectFit: 'contain', marginBottom: 4 },
  sigLine: { width: 160, borderBottomWidth: 0.8, borderColor: C.gray400, marginBottom: 4 },
  sigName: { fontSize: 8, fontWeight: 'bold', color: C.gray800 },
  sigRole: { fontSize: 7, color: C.gray600 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.white, opacity: 0.8 },
  pageNumber: { position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', fontSize: 7, color: C.white },
});

interface ServiceOrderReportPDFProps {
  order: any;
  progress: any[];
  events: any[];
  isTest: boolean;
  signatureUrl?: string;
  signerName?: string;
}

const EVENT_LABELS: Record<string, string> = {
  order_created: 'Orden creada', marked_ready: 'Marcada como lista',
  technician_assigned: 'Técnico asignado', order_started: 'Trabajo iniciado',
  progress_added: 'Avance registrado', order_completed: 'Trabajo completado',
  corrections_requested: 'Correcciones solicitadas', order_reopened: 'Trabajo retomado',
  order_approved: 'Orden aprobada', order_cancelled: 'Orden cancelada',
};

export default function ServiceOrderReportPDF({ order, progress, events, isTest, signatureUrl, signerName }: ServiceOrderReportPDFProps) {
  const caseNum = order.service_case?.case_number;
  const numberLabel = isTest ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
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

        {/* Title */}
        <View style={s.titleBanner}>
          <Text style={s.titleText}>ORDEN DE SERVICIO</Text>
          <Text style={s.titleNumber}>{numberLabel}</Text>
        </View>
        {isTest && <View style={s.testBanner}><Text style={s.testText}>DOCUMENTO DE PRUEBA — SIN VALIDEZ COMERCIAL</Text></View>}

        <View style={s.content}>
          {/* Info cards */}
          <View style={s.infoGrid}>
            <View style={s.infoCard}>
              <Text style={s.cardTitle}>Cliente</Text>
              <View style={s.field}><Text style={s.label}>Cliente</Text><Text style={s.value}>{order.client?.name || 'N/D'}</Text></View>
              {order.building?.name && <View style={s.field}><Text style={s.label}>Edificio</Text><Text style={s.value}>{order.building.name}</Text></View>}
              {order.building?.address && <View style={s.field}><Text style={s.label}>Dirección</Text><Text style={s.value}>{order.building.address}</Text></View>}
              {order.elevator?.code && <View style={s.field}><Text style={s.label}>Ascensor</Text><Text style={s.value}>{order.elevator.code}</Text></View>}
            </View>
            <View style={s.infoCard}>
              <Text style={s.cardTitle}>Orden</Text>
              <View style={s.field}><Text style={s.label}>Fecha emisión</Text><Text style={s.value}>{fmtDate(order.order_date)}</Text></View>
              {order.scheduled_date && <View style={s.field}><Text style={s.label}>Programada</Text><Text style={s.value}>{fmtDate(order.scheduled_date)}{order.scheduled_time ? ` ${order.scheduled_time}` : ''}</Text></View>}
              {order.started_at && <View style={s.field}><Text style={s.label}>Inicio</Text><Text style={s.value}>{fmtDateTime(order.started_at)}</Text></View>}
              {order.completed_at && <View style={s.field}><Text style={s.label}>Finalización</Text><Text style={s.value}>{fmtDateTime(order.completed_at)}</Text></View>}
              {order.reviewed_at && <View style={s.field}><Text style={s.label}>Aprobación</Text><Text style={s.value}>{fmtDateTime(order.reviewed_at)}</Text></View>}
              <View style={s.field}><Text style={s.label}>Tipo</Text><Text style={s.value}>{SERVICE_ORDER_TYPE_LABELS[order.order_type as keyof typeof SERVICE_ORDER_TYPE_LABELS]}</Text></View>
              <View style={s.field}><Text style={s.label}>Prioridad</Text><Text style={s.value}>{CLAIM_PRIORITY_LABELS[order.priority as keyof typeof CLAIM_PRIORITY_LABELS]}</Text></View>
            </View>
          </View>

          {/* Work requested */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Trabajo Solicitado</Text>
            <Text style={s.desc}>{order.work_requested || 'No informado'}</Text>
          </View>

          {/* Reviewer notes */}
          {(order as any).reviewer_notes && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Observaciones del Revisor</Text>
              <Text style={s.desc}>{(order as any).reviewer_notes}</Text>
            </View>
          )}

          {/* Technicians */}
          {order.technicians && order.technicians.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Técnicos Asignados</Text>
              {order.technicians.map((t: any, i: number) => (
                <View key={i} style={{ marginBottom: 3 }}>
                  <Text style={s.value}>{t.technician?.full_name || 'N/D'}{t.is_lead ? ' — Principal' : ''}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SICOM Patagonia SRL — {numberLabel}</Text>
          <Text style={s.footerText}>Documento generado por el sistema SICOM</Text>
        </View>
        <Text style={s.pageNumber} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </Page>

      {/* Page 2+: Progress and History */}
      {(progress.length > 0 || events.length > 0) && (
        <Page size="A4" style={s.page}>
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

          <View style={s.content}>
            {/* Progress */}
            {progress.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Avances Registrados</Text>
                {progress.map((p, i) => (
                  <View key={i} style={i % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.td}>{p.note}</Text>
                      <Text style={{ fontSize: 7, color: C.gray400, marginTop: 2 }}>{p.tech?.full_name || 'Técnico'} — {fmtDateTime(p.created_at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* History */}
            {events.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Historial</Text>
                {events.map((e, i) => (
                  <View key={i} style={s.eventRow}>
                    <View style={s.eventDot} />
                    <View style={s.eventText}>
                      <Text style={s.eventTitle}>{EVENT_LABELS[e.event_type] || e.event_type}</Text>
                      {e.performer?.full_name && <Text style={s.eventMeta}>{e.performer.full_name}</Text>}
                      <Text style={s.eventMeta}>{fmtDateTime(e.created_at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Signature */}
            <View style={s.sigRow}>
              <View style={s.sigBlock}>
                {signatureUrl ? <Image src={signatureUrl} style={s.sigImg} /> : <View style={s.sigLine} />}
                {signerName && signerName !== 'Administrador' ? (
                  <>
                    <Text style={s.sigName}>{signerName}</Text>
                    <Text style={s.sigRole}>Administrador</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.sigName}>Administrador</Text>
                    <Text style={s.sigRole}>SICOM Patagonia SRL</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          <View style={s.footer} fixed>
            <Text style={s.footerText}>SICOM Patagonia SRL — {numberLabel}</Text>
            <Text style={s.footerText}>Documento generado por el sistema SICOM</Text>
          </View>
          <Text style={s.pageNumber} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </Page>
      )}
    </Document>
  );
}
