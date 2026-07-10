import { supabase } from '@/config/supabase';

export async function listServiceReportSends(serviceRecordId: string) {
  const { data, error } = await supabase
    .from('service_report_sends')
    .select('*')
    .eq('service_record_id', serviceRecordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function sendServiceReportByEmail(
  serviceRecordId: string,
  pdfBase64: string,
  pdfFilename: string
): Promise<{ success: number; failed: number; mock: boolean; results: any[] }> {
  const { data, error } = await supabase.functions.invoke('send-service-report', {
    body: {
      service_record_id: serviceRecordId,
      pdf_base64: pdfBase64,
      pdf_filename: pdfFilename,
    },
  });

  if (error) throw error;
  return data;
}
