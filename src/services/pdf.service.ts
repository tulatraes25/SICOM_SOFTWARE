import { supabase } from '@/config/supabase';

/**
 * Sube un PDF generado en el navegador a Supabase Storage
 * @param file Blob del PDF
 * @param elevatorCode Código del ascensor
 * @param period Período (YYYY-MM)
 * @returns URL pública del PDF
 */
export async function uploadPDFToStorage(
  file: Blob,
  elevatorCode: string,
  period: string
): Promise<string> {
  const fileName = `${elevatorCode}/${period}/informe-${elevatorCode}-${period}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('reports')
    .upload(fileName, file, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('reports')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Actualiza la URL del PDF en el informe mensual
 */
export async function updateReportPDFUrl(
  reportId: string,
  pdfUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('monthly_reports')
    .update({
      pdf_url: pdfUrl,
      pdf_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (error) throw error;
}

/**
 * Registra auditoría de generación de PDF
 */
export async function logPDFGeneration(reportId: string, pdfUrl: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  await supabase
    .from('audit_logs')
    .insert({
      user_id: user?.id,
      action: 'generate_pdf',
      entity_type: 'monthly_report',
      entity_id: reportId,
      new_data: { pdf_url: pdfUrl },
    });
}
