import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import ReportPDF from '@/components/pdf/ReportPDF';

/**
 * Genera un Blob de PDF a partir de los datos del informe
 */
export async function generatePDFBlob(data: {
  report: any;
  elevator: any;
  building: any;
  client: any;
  supervisor?: any;
  technician?: any;
}): Promise<Blob> {
  const blob = await pdf(
    <ReportPDF
      report={data.report}
      elevator={data.elevator}
      building={data.building}
      client={data.client}
      supervisor={data.supervisor}
      technician={data.technician}
    />
  ).toBlob();

  return blob;
}

/**
 * Hook para generar y subir PDF
 */
export function usePDFGenerator() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAndUpload = async (
    reportId: string,
    data: {
      report: any;
      elevator: any;
      building: any;
      client: any;
      supervisor?: any;
      technician?: any;
    }
  ): Promise<string | null> => {
    setGenerating(true);
    setError(null);

    try {
      // Generar PDF como Blob
      const blob = await generatePDFBlob(data);

      // Verificar que sea PDF real
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Verificar magic number %PDF
      const header = String.fromCharCode(...uint8Array.slice(0, 5));
      if (header !== '%PDF-') {
        throw new Error('El archivo generado no es un PDF válido');
      }

      // Subir a Storage
      const { uploadPDFToStorage, updateReportPDFUrl, logPDFGeneration } = await import('@/services/pdf.service');
      
      const elevatorCode = data.elevator?.code || 'unknown';
      const period = data.report?.period || 'unknown';
      
      const pdfUrl = await uploadPDFToStorage(blob, elevatorCode, period);
      await updateReportPDFUrl(reportId, pdfUrl);
      await logPDFGeneration(reportId, pdfUrl);

      return pdfUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar PDF';
      setError(message);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { generateAndUpload, generating, error };
}
