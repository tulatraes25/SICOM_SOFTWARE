import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { CompanyDocumentSettings } from '@/types/database';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#8DB600',
    paddingBottom: 10,
    marginBottom: 15,
  },
  logo: {
    width: 80,
    height: 32,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  companyDetails: {
    fontSize: 7,
    color: '#666',
    marginTop: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#06172E',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
});

interface DocumentHeaderProps {
  settings?: CompanyDocumentSettings | null;
  logoUrl?: string | null;
  title?: string;
  subtitle?: string;
}

export default function DocumentHeader({
  settings,
  logoUrl,
  title,
  subtitle,
}: DocumentHeaderProps) {
  return (
    <View>
      <View style={styles.header}>
        {logoUrl && (
          <Image src={logoUrl} style={styles.logo} />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.companyName}>
            {settings?.company_name || 'SICOM Patagonia SRL'}
          </Text>
          {settings?.phone && (
            <Text style={styles.companyDetails}>{settings.phone}</Text>
          )}
          {settings?.website && (
            <Text style={styles.companyDetails}>{settings.website}</Text>
          )}
          {settings?.email && (
            <Text style={styles.companyDetails}>{settings.email}</Text>
          )}
        </View>
      </View>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}
