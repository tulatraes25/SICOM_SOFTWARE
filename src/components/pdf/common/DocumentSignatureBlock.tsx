import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  signatureBlock: {
    flex: 1,
    alignItems: 'center',
  },
  signatureLine: {
    width: 150,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 5,
  },
  signatureImage: {
    width: 120,
    height: 40,
    objectFit: 'contain',
    marginBottom: 5,
  },
  signatureName: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  signatureRole: {
    fontSize: 7,
    color: '#666',
    textAlign: 'center',
  },
  signatureDate: {
    fontSize: 7,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },
  fallbackText: {
    fontSize: 7,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

interface SignatureData {
  name: string;
  role: string;
  date?: string;
  signedUrl?: string;
}

interface DocumentSignatureBlockProps {
  technician?: SignatureData;
  approver?: SignatureData;
}

export default function DocumentSignatureBlock({
  technician,
  approver,
}: DocumentSignatureBlockProps) {
  const renderSignature = (sig: SignatureData, label: string) => (
    <View style={styles.signatureBlock}>
      {sig.signedUrl ? (
        <Image src={sig.signedUrl} style={styles.signatureImage} />
      ) : (
        <View style={styles.signatureLine} />
      )}
      <Text style={styles.signatureName}>{sig.name}</Text>
      <Text style={styles.signatureRole}>{label}: {sig.role}</Text>
      {sig.date && (
        <Text style={styles.signatureDate}>Fecha: {sig.date}</Text>
      )}
      {!sig.signedUrl && (
        <Text style={styles.fallbackText}>Documento aprobado electrónicamente</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {technician && renderSignature(technician, 'Técnico')}
      {approver && renderSignature(approver, 'Aprobado por')}
    </View>
  );
}
