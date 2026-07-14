import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { CompanyDocumentSettings } from '@/types/database';

const styles = StyleSheet.create({
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#8DB600',
    fontSize: 7,
    color: '#999',
    textAlign: 'center',
  },
  footerText: {
    marginBottom: 2,
  },
  pagination: {
    marginTop: 4,
    fontSize: 6,
    color: '#bbb',
  },
});

interface DocumentFooterProps {
  settings?: CompanyDocumentSettings | null;
  pageNumber?: number;
  totalPages?: number;
}

export default function DocumentFooter({
  settings,
  pageNumber,
  totalPages,
}: DocumentFooterProps) {
  return (
    <View style={styles.footer} fixed>
      {settings?.footer_text && (
        <Text style={styles.footerText}>{settings.footer_text}</Text>
      )}
      <Text style={styles.footerText}>
        {settings?.company_name || 'SICOM Patagonia SRL'}
        {settings?.phone ? ` — ${settings.phone}` : ''}
        {settings?.website ? ` — ${settings.website}` : ''}
      </Text>
      {pageNumber && totalPages && (
        <Text style={styles.pagination}>Página {pageNumber} de {totalPages}</Text>
      )}
    </View>
  );
}
