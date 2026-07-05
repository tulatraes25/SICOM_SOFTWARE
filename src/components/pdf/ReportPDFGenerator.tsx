import { useState } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import ReportPDF from './ReportPDF';
import Button from '@/components/ui/Button';
import { Download, Eye, Loader2 } from 'lucide-react';

interface ReportPDFGeneratorProps {
  report: any;
  elevator: any;
  building: any;
  client: any;
  supervisor?: any;
  technician?: any;
}

export default function ReportPDFGenerator({
  report,
  elevator,
  building,
  client,
  supervisor,
  technician,
}: ReportPDFGeneratorProps) {
  const [showPreview, setShowPreview] = useState(false);

  const pdfDocument = (
    <ReportPDF
      report={report}
      elevator={elevator}
      building={building}
      client={client}
      supervisor={supervisor}
      technician={technician}
    />
  );

  const fileName = `informe-${elevator?.code || 'ascensor'}-${report?.period || 'periodo'}.pdf`;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <PDFDownloadLink document={pdfDocument} fileName={fileName}>
          {({ loading }) => (
            <Button disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  Descargar PDF
                </>
              )}
            </Button>
          )}
        </PDFDownloadLink>

        <Button
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye size={16} className="mr-2" />
          {showPreview ? 'Ocultar Vista Previa' : 'Vista Previa'}
        </Button>
      </div>

      {showPreview && (
        <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
          <PDFViewer width="100%" height="100%">
            {pdfDocument}
          </PDFViewer>
        </div>
      )}
    </div>
  );
}
