import { supabase } from '@/config/supabase';

export const CASE_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const CASE_DOCUMENT_BUCKET = 'service-case-documents';

type DocumentBucket = 'service-order-reports' | typeof CASE_DOCUMENT_BUCKET;

export interface CaseDocument {
  id: string;
  documentType: 'order_pdf' | 'attachment';
  title: string;
  fileName: string;
  version: number;
  status: string;
  generatedAt: string;
  generatedBy?: string;
  generatedByName?: string;
  documentDate?: string;
  fileSize?: number;
  storagePath: string;
  storageBucket: DocumentBucket;
  isCurrent: boolean;
}

interface CaseAttachmentRow {
  id: string;
  title: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  document_date: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  uploaded_user?: { full_name: string } | null;
}

function mapAttachment(row: CaseAttachmentRow): CaseDocument {
  return {
    id: row.id,
    documentType: 'attachment',
    title: row.title,
    fileName: row.file_name,
    version: 1,
    status: 'attached',
    generatedAt: row.uploaded_at,
    generatedBy: row.uploaded_by ?? undefined,
    generatedByName: row.uploaded_user?.full_name,
    documentDate: row.document_date ?? undefined,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    storageBucket: CASE_DOCUMENT_BUCKET,
    isCurrent: false,
  };
}

export async function listCaseDocuments(serviceCaseId: string): Promise<CaseDocument[]> {
  const [pdfResult, attachmentsResult] = await Promise.all([
    supabase
      .from('service_order_pdf_versions')
      .select(`
        *,
        generated_user:profiles!service_order_pdf_versions_generated_by_fkey(full_name),
        order:service_orders(subject, status)
      `)
      .eq('service_case_id', serviceCaseId)
      .order('generated_at', { ascending: false }),
    supabase
      .from('service_case_documents')
      .select(`
        *,
        uploaded_user:profiles!service_case_documents_uploaded_by_fkey(full_name)
      `)
      .eq('service_case_id', serviceCaseId)
      .order('uploaded_at', { ascending: false }),
  ]);

  if (pdfResult.error) throw pdfResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;

  const documents: CaseDocument[] = (pdfResult.data || []).map(v => ({
    id: v.id,
    documentType: 'order_pdf',
    title: `Orden de Servicio — ${v.order?.subject || ''}`,
    fileName: v.storage_path.split('/').pop() || 'documento.pdf',
    version: v.version,
    status: v.order?.status || 'unknown',
    generatedAt: v.generated_at,
    generatedBy: v.generated_by,
    generatedByName: v.generated_user?.full_name,
    storagePath: v.storage_path,
    storageBucket: 'service-order-reports',
    isCurrent: v.is_current,
  }));

  documents.push(...(attachmentsResult.data || []).map(mapAttachment));
  return documents.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export async function validateCasePdf(file: File): Promise<void> {
  if (!/\.pdf$/i.test(file.name) || (file.type && !['application/pdf', 'application/x-pdf', 'application/octet-stream'].includes(file.type))) {
    throw new Error('Seleccioná un archivo PDF.');
  }
  const hasControlCharacters = Array.from(file.name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (file.name.length > 255 || /[\\/]/.test(file.name) || hasControlCharacters) {
    throw new Error('Renombrá el archivo PDF con un nombre de hasta 255 caracteres, sin barras.');
  }
  if (file.size === 0) throw new Error('El archivo PDF está vacío.');
  if (file.size > CASE_DOCUMENT_MAX_BYTES) throw new Error('El PDF supera el máximo de 20 MB.');

  const header = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo PDF.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file.slice(0, 8));
  });
  if (!/^%PDF-\d\.\d/.test(header)) {
    throw new Error('El archivo no contiene un PDF válido.');
  }
}

export async function uploadCaseDocument({
  serviceCaseId,
  file,
  title,
  documentDate,
}: {
  serviceCaseId: string;
  file: File;
  title?: string;
  documentDate?: string;
}): Promise<CaseDocument> {
  await validateCasePdf(file);
  const documentTitle = title?.trim() || file.name.replace(/\.pdf$/i, '');
  if (!documentTitle || documentTitle.length > 200) {
    throw new Error('El título debe tener entre 1 y 200 caracteres.');
  }
  if (documentDate && (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate) || Number.isNaN(Date.parse(documentDate)) || new Date(documentDate).toISOString().slice(0, 10) !== documentDate)) {
    throw new Error('La fecha del documento no es válida.');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Iniciá sesión para adjuntar un PDF.');

  const documentId = crypto.randomUUID();
  // Only UUIDs form the object path; the original name is metadata, never a path.
  const storagePath = `${serviceCaseId}/${user.id}/${documentId}.pdf`;
  const bucket = supabase.storage.from(CASE_DOCUMENT_BUCKET);
  const { error: uploadError } = await bucket.upload(storagePath, file, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw new Error(`No se pudo subir el PDF: ${uploadError.message}`);

  try {
    const { data, error } = await supabase.rpc('register_service_case_document', {
      p_document_id: documentId,
      p_case_id: serviceCaseId,
      p_file_name: file.name,
      p_title: documentTitle,
      p_document_date: documentDate || null,
    });
    if (error) throw error;
    if (!data?.id) throw new Error('No se recibió la confirmación del documento.');
    return mapAttachment(data);
  } catch (registrationError) {
    // A lost HTTP response can occur after commit. Reconcile before cleanup so a
    // saved attachment is not presented as a failed upload or uploaded twice.
    try {
      const { data } = await supabase.from('service_case_documents')
        .select('*').eq('id', documentId).maybeSingle();
      if (data) return mapAttachment(data);
    } catch {
      // The storage DELETE policy also forbids removing registered documents.
    }
    let cleanupFailed = false;
    try {
      const { error } = await bucket.remove([storagePath]);
      cleanupFailed = !!error;
    } catch {
      cleanupFailed = true;
    }
    const reason = registrationError && typeof registrationError === 'object' && 'message' in registrationError
      ? String(registrationError.message) : 'Error al registrar el documento.';
    throw new Error(cleanupFailed
      ? `${reason} No se pudo confirmar la limpieza de la carga. Actualizá los documentos antes de reintentar.`
      : `${reason} Actualizá los documentos antes de reintentar.`);
  }
}

export async function getDocumentUrl(document: Pick<CaseDocument, 'storagePath' | 'storageBucket'>): Promise<string> {
  const { data, error } = await supabase.storage
    .from(document.storageBucket)
    .createSignedUrl(document.storagePath, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No se pudo abrir el documento.');
  return data.signedUrl;
}
