import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_NAME, COMPANY_SLOGAN, COMPANY_WEBSITE, COMPANY_ADDRESS } from '@/config/constants';

interface ReportPDFProps {
  report: {
    period: string;
    content?: string;
    approved_at?: string;
    services_count?: number;
  };
  elevator: {
    code: string;
    manufacturer?: string;
    model?: string;
    elevator_type?: string;
    operational_status?: string;
    conservation_status?: string;
  };
  building: {
    name: string;
    address: string;
    locality: string;
    province: string;
  };
  client: {
    name: string;
    contact_name?: string;
  };
  supervisor?: {
    full_name: string;
  };
  technician?: {
    full_name: string;
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#8DB600',
    paddingBottom: 15,
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 45,
  },
  headerRight: {
    textAlign: 'right',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  companySlogan: {
    fontSize: 7,
    color: '#666',
    marginTop: 2,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8DB600',
    marginTop: 10,
    textAlign: 'center',
  },
  period: {
    fontSize: 12,
    marginTop: 5,
    color: '#333',
    textAlign: 'center',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#8DB600',
    paddingBottom: 5,
    marginBottom: 10,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 8,
    color: '#666',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    fontSize: 10,
    lineHeight: 1.6,
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#8DB600',
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
  footerWebsite: {
    color: '#8DB600',
    marginTop: 5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusOperativo: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusObservado: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  statusRequiere: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
});

const STATUS_LABELS: Record<string, string> = {
  operativo: 'Operativo',
  operativo_con_observaciones: 'Operativo con observaciones',
  no_operativo: 'No operativo',
  fuera_de_servicio_preventivo: 'Fuera de servicio preventivo',
  fuera_de_servicio_por_reparacion: 'Fuera de servicio por reparación',
  conforme: 'Conforme',
  observado: 'Observado',
  requiere_reparacion: 'Requiere reparación',
  fuera_de_servicio: 'Fuera de servicio',
  pendiente_de_verificacion: 'Pendiente de verificación',
};

export default function ReportPDF({
  report,
  elevator,
  building,
  client,
  supervisor,
  technician,
}: ReportPDFProps) {
  const getStatusStyle = (status: string) => {
    if (['operativo', 'conforme'].includes(status)) return styles.statusOperativo;
    if (['observado', 'operativo_con_observaciones'].includes(status)) return styles.statusObservado;
    return styles.statusRequiere;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.companyName}>SICOM</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.companyName}>{COMPANY_NAME}</Text>
            <Text style={styles.companySlogan}>{COMPANY_SLOGAN}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.reportTitle}>Informe Técnico Mensual de Mantenimiento de Ascensor</Text>
        <Text style={styles.period}>Período: {report.period}</Text>

        {/* Datos del Equipo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Equipo</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Código</Text>
              <Text style={styles.infoValue}>{elevator.code}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Edificio</Text>
              <Text style={styles.infoValue}>{building.name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Dirección</Text>
              <Text style={styles.infoValue}>{building.address}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Localidad</Text>
              <Text style={styles.infoValue}>{building.locality}, {building.province}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Cliente</Text>
              <Text style={styles.infoValue}>{client.name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tipo de Elevador</Text>
              <Text style={styles.infoValue}>{elevator.elevator_type || 'No informado'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fabricante</Text>
              <Text style={styles.infoValue}>{elevator.manufacturer || 'No informado'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Modelo</Text>
              <Text style={styles.infoValue}>{elevator.model || 'No informado'}</Text>
            </View>
          </View>
        </View>

        {/* Datos del Informe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Informe</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha de Aprobación</Text>
              <Text style={styles.infoValue}>
                {report.approved_at 
                  ? new Date(report.approved_at).toLocaleDateString('es-AR')
                  : 'No informado'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Supervisor</Text>
              <Text style={styles.infoValue}>{supervisor?.full_name || 'No informado'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Técnico</Text>
              <Text style={styles.infoValue}>{technician?.full_name || 'No informado'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Servicios en el período</Text>
              <Text style={styles.infoValue}>{report.services_count || 0}</Text>
            </View>
          </View>
        </View>

        {/* Estados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estados del Equipo</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Estado Operativo</Text>
              <Text style={[styles.statusBadge, getStatusStyle(elevator.operational_status || '')]}>
                {STATUS_LABELS[elevator.operational_status || ''] || elevator.operational_status || 'No informado'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Estado de Conservación</Text>
              <Text style={[styles.statusBadge, getStatusStyle(elevator.conservation_status || '')]}>
                {STATUS_LABELS[elevator.conservation_status || ''] || elevator.conservation_status || 'No informado'}
              </Text>
            </View>
          </View>
        </View>

        {/* Contenido del Informe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contenido del Informe</Text>
          <Text style={styles.content}>
            {report.content || 'No hay contenido disponible'}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Este informe corresponde a registros internos de {COMPANY_NAME}.
          </Text>
          <Text>
            No reemplaza libros digitales oficiales ni trámites ante organismos públicos.
          </Text>
          <Text style={{ marginTop: 5 }}>
            {COMPANY_NAME} - {COMPANY_ADDRESS}
          </Text>
          <Text style={styles.footerWebsite}>{COMPANY_WEBSITE}</Text>
        </View>
      </Page>
    </Document>
  );
}
