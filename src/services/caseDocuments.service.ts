import { supabase } from '@/config/supabase';

export interface CaseDocument {
  id: string;
  documentType: string;
  title: string;
  fileName: string;
  version: number;
  status: string;
  generatedAt: string;
  generatedBy?: string;
  generatedByName?: string;
  storagePath: string;
  isCurrent: boolean;
}

export async function listCaseDocuments(serviceCaseId: string): Promise<CaseDocument[]> {
  // Get service order PDF versions
  const { data: pdfVersions, error: pdfError } = await supabase
    .from('service_order_pdf_versions')
    .select(`
      *,
      generated_user:profiles!service_order_pdf_versions_generated_by_fkey(full_name),
      order:service_orders(subject, status)
    `)
    .eq('service_case_id', serviceCaseId)
    .order('version', { ascending: false });

  if (pdfError) throw pdfError;

  const documents: CaseDocument[] = (pdfVersions || []).map(v => ({
    id: v.id,
    documentType: 'order_pdf',
    title: `Orden de Servicio — ${(v.order as any)?.subject || ''}`,
    fileName: v.storage_path.split('/').pop() || 'documento.pdf',
    version: v.version,
    status: (v.order as any)?.status || 'unknown',
    generatedAt: v.generated_at,
    generatedBy: (v.generated_user as any)?.full_name,
    storagePath: v.storage_path,
    isCurrent: v.is_current,
  }));

  return documents;
}

export async function getDocumentUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from('service-order-reports')
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl || null;
}
