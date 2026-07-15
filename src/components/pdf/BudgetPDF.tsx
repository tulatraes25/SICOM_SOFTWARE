import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Budget, BudgetItem } from '@/types/database';
import DocumentHeader from './common/DocumentHeader';
import DocumentFooter from './common/DocumentFooter';
import DocumentSignatureBlock from './common/DocumentSignatureBlock';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

const fmtDate = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, lineHeight: 1.4 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#06172E', borderBottomWidth: 1, borderBottomColor: '#8DB600', paddingBottom: 4, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#06172E', textAlign: 'center', marginBottom: 5 },
  subtitle: { fontSize: 9, color: '#666', textAlign: 'center', marginBottom: 15 },
  infoRow: { flexDirection: 'row', marginBottom: 4, fontSize: 9 },
  infoLabel: { width: '30%', color: '#666' },
  infoValue: { flex: 1, color: '#333' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#8DB600', paddingBottom: 4, marginBottom: 4, fontSize: 8, fontWeight: 'bold', color: '#06172E' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingBottom: 4, marginBottom: 4, fontSize: 8 },
  colDesc: { width: '40%' },
  colQty: { width: '10%', textAlign: 'right' },
  colUnit: { width: '10%', textAlign: 'center' },
  colPrice: { width: '18%', textAlign: 'right' },
  colSubtotal: { width: '22%', textAlign: 'right' },
  totals: { alignItems: 'flex-end', marginTop: 10 },
  totalRow: { flexDirection: 'row', gap: 10, marginBottom: 3, fontSize: 9 },
  totalLabel: { width: 100, textAlign: 'right', color: '#666' },
  totalValue: { width: 100, textAlign: 'right' },
  totalFinal: { fontSize: 11, fontWeight: 'bold', color: '#06172E', borderTopWidth: 1, borderTopColor: '#8DB600', paddingTop: 4, marginTop: 4 },
  textBlock: { fontSize: 9, color: '#444', marginBottom: 8 },
  note: { fontSize: 8, color: '#666', fontStyle: 'italic' },
});

interface BudgetPDFProps {
  budget: Budget & { items?: BudgetItem[] };
  logoUrl?: string | null;
  signatureUrl?: string | null;
  signerName?: string;
}

export default function BudgetPDF({ budget, logoUrl, signatureUrl, signerName }: BudgetPDFProps) {
  const caseNum = (budget.service_case as any)?.case_number;
  const caseMode = (budget.service_case as any)?.numbering_mode;
  const clientName = (budget.client as any)?.name || 'N/D';
  const buildingName = (budget.building as any)?.name || '';
  const elevatorCode = (budget.elevator as any)?.code || '';

  const numberLabel = caseMode === 'test'
    ? `PRUEBA N.º ${caseNum}`
    : `N.º ${caseNum}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <DocumentHeader
          settings={{
            company_name: 'SICOM Patagonia SRL',
            phone: '+54 297 421-4430',
            website: 'https://sicompatagonia.com/',
          }}
          logoUrl={logoUrl}
          title="PRESUPUESTO"
          subtitle={numberLabel}
        />

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha:</Text>
            <Text style={styles.infoValue}>{fmtDate(budget.budget_date)}</Text>
          </View>
          {budget.valid_until && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Válido hasta:</Text>
              <Text style={styles.infoValue}>{fmtDate(budget.valid_until)}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente:</Text>
            <Text style={styles.infoValue}>{clientName}</Text>
          </View>
          {buildingName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Edificio:</Text>
              <Text style={styles.infoValue}>{buildingName}</Text>
            </View>
          )}
          {elevatorCode && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ascensor:</Text>
              <Text style={styles.infoValue}>{elevatorCode}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Asunto:</Text>
            <Text style={styles.infoValue}>{budget.subject}</Text>
          </View>
        </View>

        {budget.introduction && (
          <View style={styles.section}>
            <Text style={styles.textBlock}>{budget.introduction}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DETALLE</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Descripción</Text>
            <Text style={styles.colQty}>Cant.</Text>
            <Text style={styles.colUnit}>Unidad</Text>
            <Text style={styles.colPrice}>P. Unitario</Text>
            <Text style={styles.colSubtotal}>Subtotal</Text>
          </View>
          {budget.items?.sort((a, b) => a.item_order - b.item_order).map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{item.unit || '-'}</Text>
              <Text style={styles.colPrice}>{fmt(item.unit_price)}</Text>
              <Text style={styles.colSubtotal}>{fmt(item.line_subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{fmt(budget.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA {budget.tax_rate}%:</Text>
            <Text style={styles.totalValue}>{fmt(budget.tax_amount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalFinal]}>
            <Text style={styles.totalLabel}>TOTAL:</Text>
            <Text style={styles.totalValue}>{fmt(budget.total)}</Text>
          </View>
        </View>

        {budget.payment_terms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONDICIONES DE PAGO</Text>
            <Text style={styles.textBlock}>{budget.payment_terms}</Text>
          </View>
        )}

        {budget.delivery_terms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PLAZO / CONDICIONES DE ENTREGA</Text>
            <Text style={styles.textBlock}>{budget.delivery_terms}</Text>
          </View>
        )}

        {budget.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OBSERVACIONES</Text>
            <Text style={styles.textBlock}>{budget.notes}</Text>
          </View>
        )}

        <DocumentSignatureBlock
          approver={signerName ? {
            name: signerName,
            role: 'Administrador',
            date: budget.ready_at ? fmtDate(budget.ready_at.split('T')[0]) : undefined,
            signedUrl: signatureUrl || undefined,
          } : undefined}
        />

        <DocumentFooter
          settings={{
            company_name: 'SICOM Patagonia SRL',
            phone: '+54 297 421-4430',
            website: 'https://sicompatagonia.com/',
          }}
        />
      </Page>
    </Document>
  );
}
