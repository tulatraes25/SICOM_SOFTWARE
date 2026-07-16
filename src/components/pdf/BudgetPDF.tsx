import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Budget, BudgetItem } from '@/types/database';
import logoSicom from '@/assets/logo-sicom.png';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
const fmtDate = (d: string) => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${parseInt(day)}/${parseInt(m)}/${y}`; };

const C = { navy: '#06172E', green: '#8DB600', white: '#FFFFFF', gray50: '#F9FAFB', gray100: '#F3F4F6', gray200: '#E5E7EB', gray400: '#9CA3AF', gray600: '#4B5563', gray800: '#1F2937' };

const s = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', fontSize: 9, color: C.gray800 },

  // HEADER
  header: { paddingHorizontal: 35, paddingTop: 25, paddingBottom: 12, backgroundColor: C.white },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 120, height: 91 },
  headerRight: { alignItems: 'flex-end', gap: 2, paddingTop: 5 },
  headerText: { fontSize: 7.5, color: C.gray600 },
  greenLine: { height: 3, backgroundColor: C.green, marginTop: 10 },

  // TITLE BANNER
  titleBanner: { backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleText: { fontSize: 18, fontWeight: 'bold', color: C.white, letterSpacing: 3 },
  titleNumber: { fontSize: 11, color: C.white, opacity: 0.9 },
  testBanner: { backgroundColor: '#FEF3C7', paddingHorizontal: 35, paddingVertical: 6 },
  testText: { fontSize: 8, fontWeight: 'bold', color: '#92400E', textAlign: 'center', letterSpacing: 1 },

  // CONTENT
  content: { paddingHorizontal: 35, paddingTop: 15 },

  // INFO CARDS
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: C.gray50, borderRadius: 4, borderWidth: 0.5, borderColor: C.gray200, padding: 10 },
  cardTitle: { fontSize: 7.5, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  cardField: { marginBottom: 4 },
  cardLabel: { fontSize: 6.5, fontWeight: 'bold', color: C.gray400, textTransform: 'uppercase', marginBottom: 1 },
  cardValue: { fontSize: 8.5, color: C.gray800 },

  // INTRO
  intro: { fontSize: 8.5, color: C.gray600, lineHeight: 1.5, marginBottom: 14, fontStyle: 'italic' },

  // TABLE
  table: { marginBottom: 10 },
  tableHeader: { flexDirection: 'row', backgroundColor: C.navy, paddingVertical: 7, paddingHorizontal: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  thText: { fontSize: 7, fontWeight: 'bold', color: C.white, textTransform: 'uppercase' },
  thNum: { width: '5%' },
  thDesc: { width: '35%' },
  thQty: { width: '9%', textAlign: 'right' },
  thUnit: { width: '11%', textAlign: 'center' },
  thPrice: { width: '18%', textAlign: 'right' },
  thSub: { width: '22%', textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderColor: C.gray200 },
  tableRowAlt: { backgroundColor: C.gray50 },
  td: { fontSize: 8, color: C.gray800 },
  tdNum: { width: '5%', textAlign: 'center', color: C.gray400 },
  tdDesc: { width: '35%' },
  tdQty: { width: '9%', textAlign: 'right' },
  tdUnit: { width: '11%', textAlign: 'center', color: C.gray400 },
  tdPrice: { width: '18%', textAlign: 'right' },
  tdSub: { width: '22%', textAlign: 'right', fontWeight: 'bold' },
  tableBottom: { borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderBottomWidth: 2, borderBottomColor: C.navy },

  // TOTALS
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  totalsBox: { width: 230 },
  totLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, fontSize: 8.5 },
  totLabel: { color: C.gray600 },
  totVal: { fontWeight: 'bold' },
  totTotal: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.navy, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 3, marginTop: 4 },
  totTotalLabel: { fontSize: 10, fontWeight: 'bold', color: C.white },
  totTotalVal: { fontSize: 12, fontWeight: 'bold', color: C.white },

  // CONDITIONS
  conditions: { backgroundColor: C.gray50, borderRadius: 4, borderWidth: 0.5, borderColor: C.gray200, padding: 10, marginBottom: 14 },
  condTitle: { fontSize: 8, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  condRow: { flexDirection: 'row', marginBottom: 3 },
  condLabel: { width: '35%', fontSize: 7.5, fontWeight: 'bold', color: C.gray600 },
  condVal: { flex: 1, fontSize: 7.5, color: C.gray800 },

  // SIGNATURE
  sigRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingRight: 10 },
  sigBlock: { width: 200, alignItems: 'center' },
  sigImg: { width: 130, height: 45, objectFit: 'contain', marginBottom: 2 },
  sigLine: { width: 160, borderBottomWidth: 0.8, borderColor: C.gray400, marginBottom: 4 },
  sigName: { fontSize: 8, fontWeight: 'bold', color: C.gray800 },
  sigRole: { fontSize: 7, color: C.gray600 },
  sigCompany: { fontSize: 6.5, color: C.gray400, marginTop: 1 },

  // FOOTER
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.navy, paddingHorizontal: 35, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 7, color: C.white, opacity: 0.8 },
});

interface BudgetPDFProps {
  budget: Budget & { items?: BudgetItem[] };
  logoUrl?: string | null;
  signatureUrl?: string | null;
  signerName?: string;
}

export default function BudgetPDF({ budget, signatureUrl, signerName }: BudgetPDFProps) {
  const caseNum = (budget.service_case as any)?.case_number;
  const caseMode = (budget.service_case as any)?.numbering_mode;
  const isTest = caseMode === 'test';
  const client = budget.client as any;
  const building = budget.building as any;
  const elevator = budget.elevator as any;
  const itemCount = budget.items?.length || 0;
  const numberLabel = isTest ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;

  const conditions: Array<{ label: string; value: string }> = [];
  if (budget.valid_until) conditions.push({ label: 'Validez', value: `Hasta el ${fmtDate(budget.valid_until)}` });
  if (budget.payment_terms) conditions.push({ label: 'Forma de pago', value: budget.payment_terms });
  if (budget.delivery_terms) conditions.push({ label: 'Plazo / Condiciones', value: budget.delivery_terms });
  if (budget.notes) conditions.push({ label: 'Observaciones', value: budget.notes });

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

        {/* TITLE BANNER */}
        <View style={s.titleBanner}>
          <Text style={s.titleText}>PRESUPUESTO</Text>
          <Text style={s.titleNumber}>{numberLabel}</Text>
        </View>

        {/* TEST BANNER */}
        {isTest && (
          <View style={s.testBanner}>
            <Text style={s.testText}>DOCUMENTO DE PRUEBA — SIN VALIDEZ COMERCIAL</Text>
          </View>
        )}

        {/* CONTENT */}
        <View style={s.content}>

          {/* INFO CARDS */}
          <View style={s.cardsRow}>
            <View style={s.card}>
              <Text style={s.cardTitle}>Datos del Cliente</Text>
              <View style={s.cardField}><Text style={s.cardLabel}>Cliente</Text><Text style={s.cardValue}>{client?.name || 'N/D'}</Text></View>
              {client?.contact_name && <View style={s.cardField}><Text style={s.cardLabel}>Contacto</Text><Text style={s.cardValue}>{client.contact_name}</Text></View>}
              {building?.name && <View style={s.cardField}><Text style={s.cardLabel}>Edificio</Text><Text style={s.cardValue}>{building.name}</Text></View>}
              {building?.address && <View style={s.cardField}><Text style={s.cardLabel}>Dirección</Text><Text style={s.cardValue}>{building.address}</Text></View>}
              {elevator?.code && <View><Text style={s.cardLabel}>Ascensor</Text><Text style={s.cardValue}>{elevator.code}</Text></View>}
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>Datos del Presupuesto</Text>
              <View style={s.cardField}><Text style={s.cardLabel}>Número</Text><Text style={s.cardValue}>{numberLabel}</Text></View>
              <View style={s.cardField}><Text style={s.cardLabel}>Fecha</Text><Text style={s.cardValue}>{fmtDate(budget.budget_date)}</Text></View>
              {budget.valid_until && <View style={s.cardField}><Text style={s.cardLabel}>Válido hasta</Text><Text style={s.cardValue}>{fmtDate(budget.valid_until)}</Text></View>}
              <View><Text style={s.cardLabel}>Asunto</Text><Text style={s.cardValue}>{budget.subject}</Text></View>
            </View>
          </View>

          {/* INTRO */}
          <Text style={s.intro}>
            {budget.introduction || 'De acuerdo con lo solicitado, presentamos el presupuesto correspondiente a los trabajos detallados a continuación.'}
          </Text>

          {/* TABLE */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.thText, s.thNum]}>#</Text>
              <Text style={[s.thText, s.thDesc]}>Descripción</Text>
              <Text style={[s.thText, s.thQty]}>Cant.</Text>
              <Text style={[s.thText, s.thUnit]}>Unidad</Text>
              <Text style={[s.thText, s.thPrice]}>P. Unit.</Text>
              <Text style={[s.thText, s.thSub]}>Subtotal</Text>
            </View>
            {budget.items?.sort((a, b) => a.item_order - b.item_order).map((item, idx) => {
              const isAlt = idx % 2 === 1;
              const isLast = idx === itemCount - 1;
              return (
                <View key={item.id} style={Object.assign({}, s.tableRow, isAlt ? s.tableRowAlt : {}, isLast ? s.tableBottom : {})}>
                <Text style={[s.td, s.tdNum]}>{idx + 1}</Text>
                <Text style={[s.td, s.tdDesc]}>{item.description}</Text>
                <Text style={[s.td, s.tdQty]}>{item.quantity}</Text>
                <Text style={[s.td, s.tdUnit]}>{item.unit || '—'}</Text>
                <Text style={[s.td, s.tdPrice]}>{fmt(item.unit_price)}</Text>
                <Text style={[s.td, s.tdSub]}>{fmt(item.line_subtotal)}</Text>
              </View>
              );
            })}
          </View>

          {/* TOTALS */}
          <View style={s.totalsRow}>
            <View style={s.totalsBox}>
              <View style={s.totLine}><Text style={s.totLabel}>Subtotal</Text><Text style={s.totVal}>{fmt(budget.subtotal)}</Text></View>
              <View style={s.totLine}><Text style={s.totLabel}>IVA {budget.tax_rate}%</Text><Text style={s.totVal}>{fmt(budget.tax_amount)}</Text></View>
              <View style={s.totTotal}>
                <Text style={s.totTotalLabel}>TOTAL</Text>
                <Text style={s.totTotalVal}>{fmt(budget.total)}</Text>
              </View>
            </View>
          </View>

          {/* CONDITIONS */}
          {conditions.length > 0 && (
            <View style={s.conditions}>
              <Text style={s.condTitle}>Condiciones Comerciales</Text>
              {conditions.map((c, i) => (
                <View key={i} style={s.condRow}>
                  <Text style={s.condLabel}>{c.label}:</Text>
                  <Text style={s.condVal}>{c.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* SIGNATURE */}
          <View style={s.sigRow}>
            <View style={s.sigBlock}>
              {signatureUrl ? <Image src={signatureUrl} style={s.sigImg} /> : <View style={s.sigLine} />}
              <Text style={s.sigName}>{signerName || 'SICOM Patagonia SRL'}</Text>
              <Text style={s.sigRole}>Administrador</Text>
              <Text style={s.sigCompany}>SICOM Patagonia SRL</Text>
            </View>
          </View>

        </View>

        {/* FOOTER */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SICOM Patagonia SRL</Text>
          <Text style={s.footerText}>+54 297 421-4430 | sicompatagonia.com</Text>
        </View>

      </Page>
    </Document>
  );
}
