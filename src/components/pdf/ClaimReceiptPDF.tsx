import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoSicom from '@/assets/logo-sicom.png';
import { CLAIM_CATEGORY_LABELS, CLAIM_PRIORITY_LABELS, CLAIM_CHANNEL_LABELS } from '@/types/database';

const C = { navy: '#06172E', green: '#8DB600', white: '#FFFFFF', gray50: '#F9FAFB', gray200: '#E5E7EB', gray400: '#9CA3AF', gray600: '#4B5563', gray800: '#1F2937' };
const fmtDate = (d: string) => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${parseInt(day)}/${parseInt(m)}/${y}`; };

const s = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', fontSize: 9, color: C.gray800 },
  header: { paddingHorizontal: 35, paddingTop: 25, paddingBottom: 12, backgroundColor: C.white },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 120, height: 91 },
  headerRight: { alignItems: 'flex-end', gap: 2, paddingTop: 5 },
  headerText: { fontSize: 7.5, color: C.gray600 },
  greenLine: { height: 3, backgroundColor: C.green, marginTop: 10 },
  titleBanner: { backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleText: { fontSize: 18, fontWeight: 'bold', color: C.white, letterSpacing: 3 },
  titleNumber: { fontSize: 11, color: C.white, opacity: 0.9 },
  testBanner: { backgroundColor: '#FEF3C7', paddingHorizontal: 35, paddingVertical: 6 },
  testText: { fontSize: 8, fontWeight: 'bold', color: '#92400E', textAlign: 'center', letterSpacing: 1 },
  content: { paddingHorizontal: 35, paddingTop: 15 },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  infoCard: { flex: 1, backgroundColor: C.gray50, borderRadius: 4, borderWidth: 0.5, borderColor: C.gray200, padding: 10 },
  cardTitle: { fontSize: 7.5, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 6 },
  field: { marginBottom: 3 },
  label: { fontSize: 6.5, fontWeight: 'bold', color: C.gray400, textTransform: 'uppercase' },
  value: { fontSize: 8.5, color: C.gray800 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 8, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 4, borderBottomWidth: 1, borderBottomColor: C.gray200, paddingBottom: 3 },
  desc: { fontSize: 9, color: C.gray800, lineHeight: 1.5 },
  sigRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, paddingRight: 10 },
  sigBlock: { width: 200, alignItems: 'center' },
  sigLine: { width: 160, borderBottomWidth: 0.8, borderColor: C.gray400, marginBottom: 4 },
  sigName: { fontSize: 8, fontWeight: 'bold', color: C.gray800 },
  sigRole: { fontSize: 7, color: C.gray600 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.white, opacity: 0.8 },
});

interface ClaimReceiptPDFProps {
  claim: any;
  isTest: boolean;
  signerName?: string;
}

export default function ClaimReceiptPDF({ claim, isTest, signerName }: ClaimReceiptPDFProps) {
  const caseNum = claim.service_case?.case_number;
  const numberLabel = isTest ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;

  return (
    <Document>
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

        <View style={s.titleBanner}>
          <Text style={s.titleText}>RECLAMO</Text>
          <Text style={s.titleNumber}>{numberLabel}</Text>
        </View>

        {isTest && <View style={s.testBanner}><Text style={s.testText}>DOCUMENTO DE PRUEBA — SIN VALIDEZ COMERCIAL</Text></View>}

        <View style={s.content}>
          <View style={s.infoGrid}>
            <View style={s.infoCard}>
              <Text style={s.cardTitle}>Datos del Cliente</Text>
              <View style={s.field}><Text style={s.label}>Cliente</Text><Text style={s.value}>{claim.client?.name || 'N/D'}</Text></View>
              <View style={s.field}><Text style={s.label}>Edificio</Text><Text style={s.value}>{claim.building?.name || 'N/D'}</Text></View>
              {claim.elevator?.code && <View><Text style={s.label}>Ascensor</Text><Text style={s.value}>{claim.elevator.code}</Text></View>}
            </View>
            <View style={s.infoCard}>
              <Text style={s.cardTitle}>Datos del Reclamo</Text>
              <View style={s.field}><Text style={s.label}>Fecha</Text><Text style={s.value}>{fmtDate(claim.claim_date)}</Text></View>
              <View style={s.field}><Text style={s.label}>Canal</Text><Text style={s.value}>{CLAIM_CHANNEL_LABELS[claim.channel as keyof typeof CLAIM_CHANNEL_LABELS] || claim.channel}</Text></View>
              <View style={s.field}><Text style={s.label}>Categoría</Text><Text style={s.value}>{CLAIM_CATEGORY_LABELS[claim.category as keyof typeof CLAIM_CATEGORY_LABELS] || claim.category}</Text></View>
              <View><Text style={s.label}>Prioridad</Text><Text style={s.value}>{CLAIM_PRIORITY_LABELS[claim.priority as keyof typeof CLAIM_PRIORITY_LABELS] || claim.priority}</Text></View>
            </View>
          </View>

          {claim.claimant_name && <View style={s.infoCard}><Text style={s.cardTitle}>Reclamante</Text><Text style={s.value}>{claim.claimant_name}{claim.claimant_phone ? ` — ${claim.claimant_phone}` : ''}</Text></View>}

          <View style={s.section}>
            <Text style={s.sectionTitle}>Descripción del Reclamo</Text>
            <Text style={s.desc}>{claim.description}</Text>
          </View>

          {claim.assigned_user && <View style={s.infoCard}><Text style={s.cardTitle}>Técnico Asignado</Text><Text style={s.value}>{claim.assigned_user.full_name}</Text></View>}

          <View style={s.sigRow}>
            <View style={s.sigBlock}>
              <View style={s.sigLine} />
              <Text style={s.sigName}>{signerName || 'SICOM Patagonia SRL'}</Text>
              <Text style={s.sigRole}>Quien registra</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>SICOM Patagonia SRL</Text>
          <Text style={s.footerText}>+54 297 421-4430 | sicompatagonia.com</Text>
        </View>
      </Page>
    </Document>
  );
}
