import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Budget, BudgetItem } from '@/types/database';
import logoSicom from '@/assets/logo-sicom.png';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

const fmtDate = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
};

const C = {
  navy: '#06172E',
  green: '#8DB600',
  white: '#FFFFFF',
  gray100: '#F3F4F6',
  gray300: '#D1D5DB',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
};

const styles = StyleSheet.create({
  page: { padding: 35, fontFamily: 'Helvetica', fontSize: 9, lineHeight: 1.4, color: C.gray900 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 50, height: 20 },
  companyName: { fontSize: 14, fontWeight: 'bold', color: C.navy },
  headerRight: { alignItems: 'flex-end', fontSize: 7, color: C.gray500, gap: 1 },
  headerLine: { height: 2, backgroundColor: C.green, marginBottom: 10 },

  // Test badge
  testBadge: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 4, padding: 6, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  testBadgeText: { fontSize: 8, fontWeight: 'bold', color: '#92400E', flex: 1 },

  // Title
  titleBlock: { alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 'bold', color: C.navy, letterSpacing: 2 },
  number: { fontSize: 10, color: C.gray700, marginTop: 4 },

  // Info grid
  infoGrid: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 7, fontWeight: 'bold', color: C.gray500, textTransform: 'uppercase', marginBottom: 1 },
  infoValue: { fontSize: 9, color: C.gray900 },

  // Intro
  intro: { fontSize: 9, color: C.gray700, marginBottom: 12, lineHeight: 1.5 },

  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: C.navy, padding: 6, borderRadius: 3 },
  tableHeaderText: { fontSize: 7, fontWeight: 'bold', color: C.white, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 5, borderBottomWidth: 0.5, borderColor: C.gray300 },
  tableRowAlt: { backgroundColor: C.gray100 },
  cell: { fontSize: 8, color: C.gray900 },
  colItem: { width: '6%', textAlign: 'center' },
  colDesc: { width: '34%' },
  colQty: { width: '10%', textAlign: 'right' },
  colUnit: { width: '12%', textAlign: 'center' },
  colPrice: { width: '18%', textAlign: 'right' },
  colSubtotal: { width: '20%', textAlign: 'right' },

  // Totals
  totalsBox: { width: 220, alignSelf: 'flex-end', marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 3, fontSize: 9 },
  totalLabel: { color: C.gray500 },
  totalValue: { fontWeight: 'bold' },
  totalFinal: { backgroundColor: C.navy, color: C.white, padding: 5, borderRadius: 3, marginTop: 2 },
  totalFinalText: { fontSize: 11, fontWeight: 'bold', color: C.white },

  // Conditions
  conditions: { marginTop: 12, padding: 8, backgroundColor: C.gray100, borderRadius: 3 },
  conditionsTitle: { fontSize: 8, fontWeight: 'bold', color: C.navy, marginBottom: 4, textTransform: 'uppercase' },
  conditionsRow: { flexDirection: 'row', marginBottom: 2, fontSize: 8 },
  conditionsLabel: { fontWeight: 'bold', width: '35%', color: C.gray700 },
  conditionsValue: { flex: 1, color: C.gray700 },

  // Signature
  signatureBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 40 },
  sigPart: { alignItems: 'center', flex: 1 },
  sigLine: { width: 150, borderBottomWidth: 1, borderColor: C.gray300, marginBottom: 4 },
  sigImage: { width: 120, height: 35, objectFit: 'contain', marginBottom: 4 },
  sigName: { fontSize: 8, fontWeight: 'bold', color: C.gray900 },
  sigRole: { fontSize: 7, color: C.gray500 },
  sigDate: { fontSize: 7, color: C.gray500, marginTop: 2 },
  sigFallback: { fontSize: 7, color: C.gray500, fontStyle: 'italic', textAlign: 'center' },

  // Footer
  footer: { position: 'absolute', bottom: 25, left: 35, right: 35, borderTopWidth: 0.5, borderTopColor: C.gray300, paddingTop: 8 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.gray500 },
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
  const clientName = (budget.client as any)?.name || 'N/D';
  const clientContact = (budget.client as any)?.contact_name || '';
  const buildingName = (budget.building as any)?.name || '';
  const buildingAddress = (budget.building as any)?.address || '';
  const elevatorCode = (budget.elevator as any)?.code || '';
  const itemCount = budget.items?.length || 0;

  const numberLabel = isTest ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;

  // Collect conditions
  const conditions: Array<{ label: string; value: string }> = [];
  if (budget.valid_until) conditions.push({ label: 'Validez de la oferta', value: `Hasta el ${fmtDate(budget.valid_until)}` });
  if (budget.payment_terms) conditions.push({ label: 'Forma de pago', value: budget.payment_terms });
  if (budget.delivery_terms) conditions.push({ label: 'Plazo / Condiciones', value: budget.delivery_terms });

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={logoSicom} style={styles.logo} />
            <View>
              <Text style={styles.companyName}>SICOM Patagonia SRL</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text>Tel: +54 297 421-4430</Text>
            <Text>sicompatagonia.com</Text>
          </View>
        </View>
        <View style={styles.headerLine} />

        {/* Test badge */}
        {isTest && (
          <View style={styles.testBadge}>
            <Text style={styles.testBadgeText}>DOCUMENTO DE PRUEBA — SIN VALIDEZ COMERCIAL</Text>
          </View>
        )}

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>PRESUPUESTO</Text>
          <Text style={styles.number}>{numberLabel}</Text>
        </View>

        {/* Info grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <View style={{ marginBottom: 4 }}><Text style={styles.infoLabel}>Cliente</Text><Text style={styles.infoValue}>{clientName}</Text></View>
            {clientContact && <View style={{ marginBottom: 4 }}><Text style={styles.infoLabel}>Contacto</Text><Text style={styles.infoValue}>{clientContact}</Text></View>}
            {buildingName && <View style={{ marginBottom: 4 }}><Text style={styles.infoLabel}>Edificio</Text><Text style={styles.infoValue}>{buildingName}</Text></View>}
            {buildingAddress && <View style={{ marginBottom: 4 }}><Text style={styles.infoLabel}>Dirección</Text><Text style={styles.infoValue}>{buildingAddress}</Text></View>}
            {elevatorCode && <View><Text style={styles.infoLabel}>Ascensor</Text><Text style={styles.infoValue}>{elevatorCode}</Text></View>}
          </View>
          <View style={styles.infoCol}>
            <View style={{ marginBottom: 4 }}><Text style={styles.infoLabel}>Fecha</Text><Text style={styles.infoValue}>{fmtDate(budget.budget_date)}</Text></View>
            {budget.valid_until && <View style={{ marginBottom: 4 }}><Text style={styles.infoLabel}>Válido hasta</Text><Text style={styles.infoValue}>{fmtDate(budget.valid_until)}</Text></View>}
            <View style={{ marginBottom: 4 }}><Text style={styles.infoLabel}>Número</Text><Text style={styles.infoValue}>{numberLabel}</Text></View>
            <View><Text style={styles.infoLabel}>Asunto</Text><Text style={styles.infoValue}>{budget.subject}</Text></View>
          </View>
        </View>

        {/* Intro */}
        {budget.introduction && <Text style={styles.intro}>{budget.introduction}</Text>}

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colItem]}>#</Text>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>Descripción</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Cant.</Text>
          <Text style={[styles.tableHeaderText, styles.colUnit]}>Unidad</Text>
          <Text style={[styles.tableHeaderText, styles.colPrice]}>P. Unitario</Text>
          <Text style={[styles.tableHeaderText, styles.colSubtotal]}>Subtotal</Text>
        </View>
        {budget.items?.sort((a, b) => a.item_order - b.item_order).map((item, idx) => (
          <View key={item.id} style={idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
            <Text style={[styles.cell, styles.colItem]}>{idx + 1}</Text>
            <Text style={[styles.cell, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.cell, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.cell, styles.colUnit]}>{item.unit || '—'}</Text>
            <Text style={[styles.cell, styles.colPrice]}>{fmt(item.unit_price)}</Text>
            <Text style={[styles.cell, styles.colSubtotal]}>{fmt(item.line_subtotal)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal ({itemCount} ítem{itemCount !== 1 ? 's' : ''})</Text>
            <Text style={styles.totalValue}>{fmt(budget.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA {budget.tax_rate}%</Text>
            <Text style={styles.totalValue}>{fmt(budget.tax_amount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalFinal]}>
            <Text style={styles.totalFinalText}>TOTAL</Text>
            <Text style={styles.totalFinalText}>{fmt(budget.total)}</Text>
          </View>
        </View>

        {/* Conditions */}
        {conditions.length > 0 && (
          <View style={styles.conditions}>
            <Text style={styles.conditionsTitle}>Condiciones Comerciales</Text>
            {conditions.map((c, i) => (
              <View key={i} style={styles.conditionsRow}>
                <Text style={styles.conditionsLabel}>{c.label}:</Text>
                <Text style={styles.conditionsValue}>{c.value}</Text>
              </View>
            ))}
            {budget.notes && (
              <View style={styles.conditionsRow}>
                <Text style={styles.conditionsLabel}>Observaciones:</Text>
                <Text style={styles.conditionsValue}>{budget.notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Signature */}
        <View style={styles.signatureBlock}>
          <View style={styles.sigPart}>
            {signatureUrl ? (
              <Image src={signatureUrl} style={styles.sigImage} />
            ) : (
              <View style={styles.sigLine} />
            )}
            <Text style={styles.sigName}>{signerName || 'SICOM Patagonia SRL'}</Text>
            <Text style={styles.sigRole}>Administrador</Text>
          </View>
          <View style={styles.sigPart}>
            <View style={styles.sigLine} />
            <Text style={styles.sigName}>Aclaración</Text>
            <Text style={styles.sigRole}>Firma y aclaración</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text>SICOM Patagonia SRL</Text>
            <Text>+54 297 421-4430 | sicompatagonia.com</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
